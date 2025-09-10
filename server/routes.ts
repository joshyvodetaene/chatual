import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertRoomSchema, insertMessageSchema, registerUserSchema, loginSchema, insertUserPhotoSchema, updateUserProfileSchema, insertBlockedUserSchema, insertReportSchema, reportSchema, updateReportStatusSchema, warnUserSchema, banUserSchema, updateNotificationSettingsSchema, insertFriendRequestSchema, friendRequestActionSchema, updatePrivacySettingsSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { NotificationService } from "./notification-service";
import { validateCityWithGoogle } from "./lib/geocoding";

interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  timestamp: number;
}

interface WebSocketClient extends WebSocket {
  userId?: string;
  roomId?: string;
  deviceId?: string;
  connectionId: string;
  deviceInfo?: DeviceInfo;
  isAlive?: boolean;
  lastActivity?: number;
  connectedAt: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Add CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // WebSocket server with proper configuration
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/socket',
    perMessageDeflate: false,
    maxPayload: 16 * 1024,
  });
  // Enhanced connection tracking for multi-device support
  const clients = new Map<string, Set<WebSocketClient>>(); // userId -> Set of connections
  const connectionsByDevice = new Map<string, WebSocketClient>(); // deviceId -> connection
  const connectionsById = new Map<string, WebSocketClient>(); // connectionId -> connection
  const roomUsers = new Map<string, Set<string>>(); // roomId -> Set of userIds
  const privateChats = new Map<string, Set<string>>(); // chatId -> Set of userIds

  // Initialize notification service - will be updated to handle multiple connections
  const notificationService = new NotificationService(new Map<string, any>());

  console.log('WebSocket server initialized on path /socket');

  // Connection health tracking constants - more lenient settings
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const CONNECTION_TIMEOUT = 180000; // 3 minutes (much more lenient)
  const CLEANUP_INTERVAL = 120000; // 2 minutes (less frequent cleanup)

  // Enhanced connection validation function - less aggressive
  function isConnectionAlive(client: WebSocketClient): boolean {
    // Only consider a connection stale if:
    // 1. WebSocket is not in OPEN state, OR
    // 2. Client explicitly marked as not alive (failed ping twice in a row)
    if (client.readyState !== WebSocket.OPEN) {
      return false;
    }

    // If client responded to recent ping, it's definitely alive
    if (client.isAlive === true) {
      return true;
    }

    // Be more lenient - only mark as dead if explicitly set to false AND no recent activity
    const now = Date.now();
    const hasRecentActivity = !client.lastActivity || (now - client.lastActivity) < CONNECTION_TIMEOUT;

    // If client has recent activity, consider it alive even if ping failed once
    if (hasRecentActivity) {
      return true;
    }

    // Only mark as dead if explicitly marked false AND no recent activity
    return client.isAlive !== false;
  }

  // Clean up stale connections and room users
  function cleanupStaleConnections() {
    console.log('[WS_CLEANUP] Starting periodic cleanup of stale connections');
    const now = Date.now();
    let cleanedConnections = 0;
    let cleanedRoomEntries = 0;

    // Clean up stale clients
    for (const [userId, clientSet] of clients.entries()) {
      const activeClients = new Set<WebSocketClient>();

      for (const client of clientSet) {
        if (!isConnectionAlive(client)) {
          console.log(`[WS_CLEANUP] Removing stale connection for user ${userId}`);

          // Remove from room if they were in one
          if (client.roomId && client.userId) {
            removeUserFromRoom(client.roomId, client.userId);
            cleanedRoomEntries++;
          }

          cleanedConnections++;

          try {
            client.close(1001, 'Connection cleanup');
          } catch (error) {
            // Connection might already be closed
          }
        } else {
          activeClients.add(client);
        }
      }

      if (activeClients.size === 0) {
        // No active connections for this user
        clients.delete(userId);

        // Update database status only when user has no active connections
        storage.updateUserOnlineStatus(userId, false).catch(error => {
          console.error(`[WS_CLEANUP] Failed to update user status for ${userId}:`, error);
        });
      } else {
        // Update the set with only active connections
        clients.set(userId, activeClients);
      }
    }

    // Validate room users against actual connections
    for (const [roomId, userSet] of roomUsers.entries()) {
      const validUsers = new Set<string>();

      for (const userId of userSet) {
        const clientSet = clients.get(userId);
        if (clientSet) {
          // Check if user has at least one active connection in this room
          const hasActiveConnection = Array.from(clientSet).some(client => 
            isConnectionAlive(client) && client.roomId === roomId
          );

          if (hasActiveConnection) {
            validUsers.add(userId);
          } else {
            cleanedRoomEntries++;
          }
        } else {
          cleanedRoomEntries++;
        }
      }

      // Update room users if any were removed
      if (validUsers.size !== userSet.size) {
        roomUsers.set(roomId, validUsers);

        // Broadcast updated online users for this room
        const onlineUsers = Array.from(validUsers);
        broadcastToRoom(roomId, {
          type: 'room_online_users',
          roomId,
          onlineUsers
        });
      }
    }

    if (cleanedConnections > 0 || cleanedRoomEntries > 0) {
      console.log(`[WS_CLEANUP] Cleaned ${cleanedConnections} stale connections and ${cleanedRoomEntries} room entries`);
    }
  }

  // Heartbeat function to check connection health
  function heartbeat() {
    console.log('[WS_HEARTBEAT] Sending ping to all connected clients');
    let activeConnections = 0;
    let staleConnections = 0;

    for (const [userId, clientSet] of clients.entries()) {
      for (const client of clientSet) {
        if (client.readyState === WebSocket.OPEN) {
          // Only mark as potentially stale if it already failed a previous ping
          // Don't immediately mark as false - give time for pong response
          if (client.isAlive === false) {
            // This client already failed a previous heartbeat, mark for cleanup
            staleConnections++;
            continue;
          }

          // For healthy connections, send ping but don't immediately mark as dead
          try {
            client.ping((error: Error | null) => {
              if (error) {
                console.log(`[WS_HEARTBEAT] Ping failed for user ${userId}: ${error.message}`);
                client.isAlive = false; // Only mark as false if ping actually failed
              }
            });
            activeConnections++;
          } catch (error) {
            console.log(`[WS_HEARTBEAT] Failed to ping user ${userId}: ${error}`);
            client.isAlive = false; // Only mark as false if ping failed
            staleConnections++;
          }
        } else {
          staleConnections++;
        }
      }
    }

    console.log(`[WS_HEARTBEAT] Pinged ${activeConnections} clients, ${staleConnections} potentially stale`);
  }

  // Start periodic heartbeat and cleanup
  const heartbeatInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
  const cleanupInterval = setInterval(cleanupStaleConnections, CLEANUP_INTERVAL);

  // Cleanup intervals on server shutdown
  const cleanup = () => {
    console.log('[WS_SHUTDOWN] Cleaning up WebSocket intervals and connections');
    clearInterval(heartbeatInterval);
    clearInterval(cleanupInterval);

    // Close all active connections
    for (const [userId, clientSet] of clients.entries()) {
      for (const client of clientSet) {
        try {
          client.close(1001, 'Server shutdown');
        } catch (error) {
          console.error(`[WS_SHUTDOWN] Error closing connection for user ${userId}:`, error);
        }
      }
    }
    clients.clear();
    roomUsers.clear();
  };

  // Handle graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGUSR2', cleanup); // For nodemon restarts


  // Helper functions for room user management
  function addUserToRoom(roomId: string, userId: string) {
    // Validate that the user actually has an active connection
    const clientSet = clients.get(userId);
    if (!clientSet || !Array.from(clientSet).some(client => isConnectionAlive(client))) {
      console.log(`[WS_ROOM] Cannot add user ${userId} to room ${roomId}: no active connection`);
      return;
    }

    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set());
    }
    roomUsers.get(roomId)!.add(userId);

    console.log(`[WS_ROOM] User ${userId} added to room ${roomId}. Room now has ${roomUsers.get(roomId)!.size} users`);

    // Broadcast updated online users for this room
    const onlineUsers = Array.from(roomUsers.get(roomId) || []);
    broadcastToRoom(roomId, {
      type: 'room_online_users',
      roomId,
      onlineUsers
    });
  }

  function removeUserFromRoom(roomId: string, userId: string) {
    if (roomUsers.has(roomId)) {
      const wasRemoved = roomUsers.get(roomId)!.delete(userId);

      if (wasRemoved) {
        console.log(`[WS_ROOM] User ${userId} removed from room ${roomId}. Room now has ${roomUsers.get(roomId)!.size} users`);
      }

      // Broadcast updated online users for this room
      const onlineUsers = Array.from(roomUsers.get(roomId) || []);
      broadcastToRoom(roomId, {
        type: 'room_online_users',
        roomId,
        onlineUsers
      });
    }
  }

  // Function to synchronize room users with actual connections
  function synchronizeRoomUsers(roomId: string) {
    const roomUserSet = roomUsers.get(roomId);
    if (!roomUserSet) return;

    const validUsers = new Set<string>();
    let removedUsers = 0;

    for (const userId of roomUserSet) {
      const clientSet = clients.get(userId);
      if (clientSet) {
        // Check if user has at least one active connection in this room
        const hasActiveConnection = Array.from(clientSet).some(client => 
          isConnectionAlive(client) && client.roomId === roomId
        );

        if (hasActiveConnection) {
          validUsers.add(userId);
        } else {
          removedUsers++;
        }
      } else {
        removedUsers++;
      }
    }

    if (removedUsers > 0) {
      roomUsers.set(roomId, validUsers);
      console.log(`[WS_SYNC] Synchronized room ${roomId}: removed ${removedUsers} stale users`);

      // Broadcast updated list
      const onlineUsers = Array.from(validUsers);
      broadcastToRoom(roomId, {
        type: 'room_online_users',
        roomId,
        onlineUsers
      });
    }
  }

  // Generate unique IDs for connections and devices
  function generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Broadcast message to all connections for a specific user (cross-device sync)
  function broadcastToUser(userId: string, message: any, excludeConnection?: WebSocketClient) {
    const userConnections = clients.get(userId);
    if (!userConnections) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const connection of userConnections) {
      if (connection !== excludeConnection && connection.readyState === WebSocket.OPEN) {
        try {
          connection.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`[WS_BROADCAST] Failed to send to device ${connection.deviceId}:`, error);
        }
      }
    }

    console.log(`[WS_BROADCAST] Sent message to ${sentCount} devices for user ${userId}`);
  }

  // Enhanced room broadcasting with cross-device support
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    const usersInRoom = roomUsers.get(roomId);
    if (!usersInRoom) return;

    const messageStr = JSON.stringify(message);
    let totalSent = 0;

    for (const userId of usersInRoom) {
      if (userId === excludeUserId) continue;

      const userConnections = clients.get(userId);
      if (userConnections) {
        for (const connection of userConnections) {
          if (connection.roomId === roomId && connection.readyState === WebSocket.OPEN) {
            try {
              connection.send(messageStr);
              totalSent++;
            } catch (error) {
              console.error(`[WS_ROOM_BROADCAST] Failed to send to user ${userId}, device ${connection.deviceId}:`, error);
            }
          }
        }
      }
    }

    console.log(`[WS_ROOM_BROADCAST] Sent to ${totalSent} connections in room ${roomId}`);
  }

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient, req) => {
    // Parse connection parameters from URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    const deviceId = url.searchParams.get('deviceId') || generateDeviceId();
    
    // Generate unique connection ID and set connection metadata
    ws.connectionId = generateConnectionId();
    ws.deviceId = deviceId;
    ws.connectedAt = Date.now();
    ws.isAlive = true;
    ws.lastActivity = Date.now();
    
    // Extract device info from headers
    ws.deviceInfo = {
      userAgent: req.headers['user-agent'],
      platform: typeof req.headers['sec-ch-ua-platform'] === 'string' 
        ? req.headers['sec-ch-ua-platform'].replace(/"/g, '') 
        : 'unknown',
      timestamp: Date.now()
    };
    
    console.log(`[WS_CONNECTION] New WebSocket connection: connectionId=${ws.connectionId}, deviceId=${ws.deviceId}, user=${userId || 'pending'}`);

    // Add to connection tracking maps
    connectionsById.set(ws.connectionId, ws);
    connectionsByDevice.set(ws.deviceId, ws);

    // Set userId and add to user's connections if provided via URL
    if (userId) {
      ws.userId = userId;
      console.log(`[WS_CONNECTION] User ${userId} identified via URL for device ${ws.deviceId}`);
      
      // Add connection to user's set
      const existingConnections = clients.get(userId) || new Set();
      existingConnections.add(ws);
      clients.set(userId, existingConnections);

      // Update user online status in database
      storage.updateUserOnlineStatus(userId, true).catch(error => {
        console.error(`[WS_CONNECTION] Failed to update user status for ${userId}:`, error);
      });

      // Notify other devices about new connection
      broadcastToUser(userId, {
        type: 'device_connected',
        deviceId: ws.deviceId,
        deviceInfo: ws.deviceInfo,
        timestamp: Date.now()
      }, ws);
    }

    // Handle pong responses (heartbeat confirmation)
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivity = Date.now();
    });

    // Handle regular error events
    ws.on('error', (error) => {
      console.error(`[WS_ERROR] WebSocket error for user ${ws.userId}:`, error);
    });

    ws.on('message', async (data) => {
      try {
        // Update last activity timestamp for any message
        ws.lastActivity = Date.now();

        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'ping':
            // Handle client-initiated ping
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;

          case 'join':
            console.log(`[WS_JOIN] Join request from userId=${message.userId}, roomId=${message.roomId}`);

            // Store previous room for cleanup
            const previousRoomId = ws.roomId;

            // Remove user from previous room if any
            if (ws.roomId && ws.userId) {
              console.log(`[WS_JOIN] Removing user ${ws.userId} from previous room ${ws.roomId}`);
              removeUserFromRoom(ws.roomId, ws.userId);
              broadcastToRoom(ws.roomId, {
                type: 'user_left',
                userId: ws.userId,
              });
            }

            // Add this connection to the user's connection set
            ws.userId = message.userId;
            ws.roomId = message.roomId;

            // Initialize or reset connection tracking for this user
            ws.isAlive = true;
            ws.lastActivity = Date.now();

            // Add connection to user's set (supporting multiple devices)
            const existingConnections = clients.get(message.userId) || new Set();
            existingConnections.add(ws);
            clients.set(message.userId, existingConnections);

            console.log(`[WS_JOIN] User ${message.userId} joining room ${message.roomId}`);

            // Update user online status
            await storage.updateUserOnlineStatus(message.userId, true);

            // Add user to new room (validates connection)
            addUserToRoom(message.roomId, message.userId);

            // Synchronize room users to ensure accuracy
            synchronizeRoomUsers(message.roomId);

            // Broadcast user joined
            broadcastToRoom(message.roomId, {
              type: 'user_joined',
              userId: message.userId,
            }, message.userId);
            break;

          case 'identify':
            // Handle user identification without joining a specific room
            console.log(`[WS_IDENTIFY] User identification request from userId=${message.userId}`);
            
            // Set user ID on the WebSocket connection
            ws.userId = message.userId;
            
            // Initialize connection tracking for this user
            ws.isAlive = true;
            ws.lastActivity = Date.now();
            
            // Add connection to user's set (supporting multiple devices)
            const existingUserConnections = clients.get(message.userId) || new Set();
            existingUserConnections.add(ws);
            clients.set(message.userId, existingUserConnections);
            
            console.log(`[WS_IDENTIFY] User ${message.userId} identified successfully`);
            
            // Update user online status
            await storage.updateUserOnlineStatus(message.userId, true);
            
            // Send confirmation back to client
            ws.send(JSON.stringify({
              type: 'identified',
              userId: message.userId,
              timestamp: Date.now()
            }));
            break;

          case 'leave':
            console.log(`[WS_LEAVE] Leave request from userId=${message.userId || ws.userId}, roomId=${message.roomId || ws.roomId}`);
            const leaveUserId = message.userId || ws.userId;
            const leaveRoomId = message.roomId || ws.roomId;

            if (leaveUserId && leaveRoomId) {
              removeUserFromRoom(leaveRoomId, leaveUserId);
              broadcastToRoom(leaveRoomId, {
                type: 'user_left',
                userId: leaveUserId,
              });
              console.log(`[WS_LEAVE] User ${leaveUserId} left room ${leaveRoomId}`);
            }
            break;

          case 'message':
            try {
              console.log(`[WS_MESSAGE] Message from user ${message.userId} in room ${message.roomId}: ${message.content?.substring(0, 50)}`);

              // Get user data to include in the message - use the userId from the WebSocket connection
              const actualUserId = ws.userId || message.userId;
              const userData = await storage.getUser(actualUserId);
              if (!userData) {
                console.error(`[WS_MESSAGE] User not found: ${actualUserId}`);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'User not found'
                }));
                return;
              }

              console.log(`[WS_MESSAGE] Creating message for user: ${userData.username} (${userData.id})`);

              // Create and store the message with the correct user ID from WebSocket connection
              const messageData = await storage.createMessage({
                content: message.content,
                photoUrl: message.photoUrl,
                photoFileName: message.photoFileName,
                messageType: message.messageType || 'text',
                mentionedUserIds: message.mentionedUserIds || [],
                userId: actualUserId, // Use the user ID from the WebSocket connection
                roomId: message.roomId,
                username: userData.username // Use actual username from database
              });

              console.log(`[WS_MESSAGE] Message stored with ID: ${messageData.id} for user: ${userData.username}`);

              // Broadcast to all users in the room
              broadcastToRoom(message.roomId, {
                type: 'new_message',
                message: messageData
              });

            } catch (error) {
              console.error('[WS_MESSAGE] Error handling message:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to send message'
              }));
            }
            break;

          case 'typing':
            console.log(`[WEBSOCKET] Processing typing event: userId=${ws.userId}, roomId=${ws.roomId}, isTyping=${message.isTyping}`);
            if (ws.userId && ws.roomId) {
              broadcastToRoom(ws.roomId, {
                type: 'user_typing',
                userId: ws.userId,
                isTyping: message.isTyping,
              }, ws.userId);
            } else {
              console.log(`[WEBSOCKET] Cannot process typing: missing userId=${ws.userId} or roomId=${ws.roomId}`);
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`[WS_CLOSE] Connection closed for user ${ws.userId}, code: ${code}, reason: ${reason}`);

      if (ws.userId) {
        // Remove this specific connection from the user's connection set
        const userConnections = clients.get(ws.userId);
        if (userConnections) {
          userConnections.delete(ws);

          if (userConnections.size === 0) {
            // No more connections for this user
            clients.delete(ws.userId);

            // Update user's online status to false
            try {
              await storage.updateUserOnlineStatus(ws.userId, false);
              console.log(`[WS_CLOSE] User ${ws.userId} marked offline - no active connections`);
            } catch (error) {
              console.error(`[WS_CLOSE] Failed to update offline status for user ${ws.userId}:`, error);
            }
          } else {
            console.log(`[WS_CLOSE] User ${ws.userId} still has ${userConnections.size} active connections`);
          }
        }

        if (ws.roomId) {
          console.log(`[WS_CLOSE] Cleaning up user ${ws.userId} from room ${ws.roomId}`);

          // Check if user still has active connections in this room
          const stillInRoom = userConnections && Array.from(userConnections).some(client => 
            client.roomId === ws.roomId && isConnectionAlive(client)
          );

          if (!stillInRoom) {
            // Remove user from room only if they have no active connections in this room
            removeUserFromRoom(ws.roomId, ws.userId);

            // Broadcast user left
            broadcastToRoom(ws.roomId, {
              type: 'user_left',
              userId: ws.userId,
            });
          }

          // Synchronize room users to ensure accuracy after disconnect
          synchronizeRoomUsers(ws.roomId);
        }
      }
    });
  });

  // Health check endpoint for deployment
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    console.log(`[AUTH] Registration attempt started at ${new Date().toISOString()}`);
    console.log(`[AUTH] Registration data:`, { ...req.body, password: '[REDACTED]' });
    try {
      const userData = registerUserSchema.parse(req.body);
      console.log(`[AUTH] Schema validation passed for username: ${userData.username}`);

      // Check if username is available
      console.log(`[AUTH] Checking username availability: ${userData.username}`);
      const isAvailable = await storage.isUsernameAvailable(userData.username);
      console.log(`[AUTH] Username ${userData.username} available: ${isAvailable}`);
      if (!isAvailable) {
        console.log(`[AUTH] Registration failed - username taken: ${userData.username}`);
        return res.status(400).json({ error: 'Username is already taken' });
      }

      console.log(`[AUTH] Creating user account for: ${userData.username}`);
      const user = await storage.registerUser(userData);
      console.log(`[AUTH] User account created successfully: ${user.id}`);

      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      console.log(`[AUTH] Registration successful for user: ${user.username}`);
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error(`[AUTH] Registration error:`, error);
      res.status(400).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    console.log(`[AUTH] Login attempt started at ${new Date().toISOString()}`);
    console.log(`[AUTH] Login attempt for username: ${req.body?.username}`);
    try {
      const credentials = loginSchema.parse(req.body);
      console.log(`[AUTH] Schema validation passed for login: ${credentials.username}`);

      console.log(`[AUTH] Authenticating user: ${credentials.username}`);
      const user = await storage.authenticateUser(credentials);
      if (!user) {
        console.log(`[AUTH] Authentication failed for username: ${credentials.username}`);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Check if user is banned
      if (user.isBanned) {
        console.log(`[AUTH] Banned user attempted login: ${user.username} (${user.id})`);
        const banReason = user.banReason || 'No reason provided';
        return res.status(403).json({ 
          error: 'Your account has been banned', 
          message: `This account has been suspended. Reason: ${banReason}. Please contact support for assistance.`,
          isBanned: true 
        });
      }

      console.log(`[AUTH] Authentication successful for user: ${user.id} (${user.username})`);
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error(`[AUTH] Login error:`, error);
      res.status(400).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    console.log(`[AUTH] Logout attempt started at ${new Date().toISOString()}`);
    console.log(`[AUTH] Logout for userId: ${req.body?.userId}`);
    try {
      const { userId } = req.body;
      if (userId) {
        console.log(`[AUTH] Updating online status to false for user: ${userId}`);
        await storage.updateUserOnlineStatus(userId, false);
        console.log(`[AUTH] Online status updated successfully for user: ${userId}`);
      } else {
        console.log(`[AUTH] No userId provided in logout request`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`[AUTH] Logout error:`, error);
      res.status(400).json({ error: 'Logout failed' });
    }
  });

  app.get('/api/auth/check-username/:username', async (req, res) => {
    console.log(`[AUTH] Username availability check for: ${req.params.username}`);
    try {
      const { username } = req.params;
      console.log(`[AUTH] Checking availability for username: ${username}`);
      const isAvailable = await storage.isUsernameAvailable(username);
      console.log(`[AUTH] Username ${username} availability: ${isAvailable}`);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error(`[AUTH] Username check error:`, error);
      res.status(400).json({ error: 'Username check failed' });
    }
  });

  // User routes
  app.get('/api/users/online', async (req, res) => {
    console.log(`[API] Fetching online users at ${new Date().toISOString()}`);
    try {
      const users = await storage.getOnlineUsers();
      console.log(`[API] Found ${users.length} online users`);
      res.json({ users });
    } catch (error) {
      console.error(`[API] Error fetching online users:`, error);
      res.status(500).json({ error: 'Failed to fetch online users' });
    }
  });

  app.get('/api/users/with-distance/:userId', async (req, res) => {
    console.log(`[API] Fetching users with distance for userId: ${req.params.userId}`);
    try {
      const { userId } = req.params;
      console.log(`[API] Getting users with distance calculation for: ${userId}`);
      const users = await storage.getUsersWithDistance(userId);
      console.log(`[API] Found ${users.length} users with distance data`);
      res.json({ users });
    } catch (error) {
      console.error(`[API] Error fetching users with distance:`, error);
      res.status(500).json({ error: 'Failed to fetch users with distance' });
    }
  });

  // GDPR Data Export endpoint
  app.get('/api/users/:userId/export-data', async (req, res) => {
    console.log(`[GDPR] Data export request for user: ${req.params.userId}`);
    try {
      const { userId } = req.params;

      // Validate user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Export user data
      const exportData = await storage.exportUserData(userId);

      // Set headers for file download
      const filename = `user-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');

      console.log(`[GDPR] Successfully exported data for user ${userId}`);
      res.json(exportData);
    } catch (error) {
      console.error(`[GDPR] Error exporting data for user ${req.params.userId}:`, error);
      res.status(500).json({ error: 'Failed to export user data' });
    }
  });

  // Private chat routes
  app.post('/api/private-chat/create', async (req, res) => {
    try {
      const { user1Id, user2Id } = req.body;

      if (!user1Id || !user2Id) {
        return res.status(400).json({ error: 'Both user IDs are required' });
      }

      if (user1Id === user2Id) {
        return res.status(400).json({ error: 'Cannot create private chat with yourself' });
      }

      // Check if room already exists
      const existingRoom = await storage.getPrivateRoom(user1Id, user2Id);
      let room = existingRoom;
      let isNewRoom = false;

      if (!existingRoom) {
        room = await storage.createPrivateRoom(user1Id, user2Id);
        isNewRoom = true;
      }

      // Get user data for the notification
      const user1 = await storage.getUser(user1Id);
      const user2 = await storage.getUser(user2Id);

      // If it's a new room, notify the target user via WebSocket
      if (isNewRoom && user1 && user2 && room) {
        console.log(`[PRIVATE_CHAT] Notifying user ${user2Id} about new private chat from ${user1Id}`);
        const notificationSent = broadcastToUser(user2Id, {
          type: 'private_chat_request',
          roomId: room.id,
          fromUser: {
            id: user1.id,
            username: user1.username,
            username: user1.username,
            primaryPhoto: user1.primaryPhoto
          },
          room: room
        });
        console.log(`[PRIVATE_CHAT] Notification sent to ${user2Id}: ${notificationSent}`);
      }

      res.json({ room, otherUser: user1Id === user1?.id ? user2 : user1 });
    } catch (error) {
      console.error('Private chat creation error:', error);
      res.status(400).json({ error: 'Failed to create private chat' });
    }
  });

  app.get('/api/private-chat/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const privateRooms = await storage.getPrivateRooms(userId);
      res.json({ privateRooms });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch private chats' });
    }
  });

  app.delete('/api/private-chat/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const result = await storage.deletePrivateRoom(roomId, userId);
      if (result.success) {
        // Notify the other participant that the chat has been closed
        if (result.otherParticipant) {
          const currentUser = await storage.getUser(userId);
          const notificationSent = broadcastToUser(result.otherParticipant.id, {
            type: 'private_chat_closed',
            roomId: roomId,
            closedBy: {
              id: currentUser?.id,
              username: currentUser?.username,
              username: currentUser?.username
            },
            message: `${currentUser?.username || 'Someone'} has closed this private chat`
          });

          console.log(`[PRIVATE_CHAT] Chat closure notification sent to ${result.otherParticipant.id}: ${notificationSent}`);
        }

        res.json({ success: true, message: 'Private chat deleted' });
      } else {
        res.status(403).json({ error: 'Not authorized to delete this chat' });
      }
    } catch (error) {
      console.error('Delete private chat error:', error);
      res.status(500).json({ error: 'Failed to delete private chat' });
    }
  });

  app.get('/api/chat-data/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const chatData = await storage.getRoomsAndPrivateRooms(userId);
      res.json(chatData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch chat data' });
    }
  });

  // Geocode validation endpoint
  app.get('/api/geocode/validate', async (req, res) => {
    try {
      const { city } = req.query;

      if (!city || typeof city !== 'string') {
        return res.status(400).json({ 
          isValid: false, 
          message: 'City parameter is required' 
        });
      }

      const result = await validateCityWithGoogle(city, ['DE', 'CH', 'AT']);
      res.json(result);
    } catch (error) {
      console.error('Geocode validation error:', error);
      res.status(500).json({ 
        isValid: false, 
        message: 'Internal server error during city validation' 
      });
    }
  });

  // City validation endpoint for the new autocomplete component
  app.post('/api/cities/validate', async (req, res) => {
    try {
      const { cityName, allowedCountries } = req.body;

      if (!cityName || typeof cityName !== 'string') {
        return res.status(400).json({ 
          isValid: false, 
          message: 'City name is required' 
        });
      }

      const allowedCountryCodes = allowedCountries || ['DE', 'CH', 'AT'];
      const result = await validateCityWithGoogle(cityName, allowedCountryCodes);
      res.json(result);
    } catch (error) {
      console.error('City validation error:', error);
      res.status(500).json({ 
        isValid: false, 
        message: 'Internal server error during city validation' 
      });
    }
  });

  // Photo upload routes
  app.post('/api/photos/upload-url', async (req, res) => {
    try {
      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: 'File name is required' });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getPhotoUploadURL(fileName);
      res.json({ uploadURL });
    } catch (error) {
      console.error('Photo upload URL error:', error);
      res.status(400).json({ error: 'Failed to get upload URL' });
    }
  });

  // Object storage upload endpoint for general file uploads
  app.post('/api/objects/upload', async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getPhotoUploadURL('message-photo.jpg');
      res.json({ uploadURL });
    } catch (error) {
      console.error('Object upload URL error:', error);
      res.status(500).json({ error: 'Failed to get upload URL' });
    }
  });

  // Serve photos with thumbnail support
  app.get('/photos/:photoPath(*)', async (req, res) => {
    const photoPath = '/photos/' + req.params.photoPath;
    const objectStorageService = new ObjectStorageService();
    try {
      console.log('Serving photo:', photoPath);
      const photoFile = await objectStorageService.getPhotoFile(photoPath);

      // Check for thumbnail request via query parameters
      const { size, width, height } = req.query;
      const thumbnailWidth = size === 'thumbnail' ? 192 : parseInt(width as string) || null;
      const thumbnailHeight = parseInt(height as string) || null;

      if (thumbnailWidth || thumbnailHeight) {
        // Generate and serve thumbnail
        await objectStorageService.downloadThumbnail(photoFile, res, thumbnailWidth, thumbnailHeight);
      } else {
        // Serve original image
        objectStorageService.downloadObject(photoFile, res);
      }
    } catch (error) {
      console.error('Error serving photo:', photoPath, error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // User photo management routes
  app.post('/api/users/:userId/photos', async (req, res) => {
    try {
      const { userId } = req.params;
      const { photoUrl, fileName, isPrimary } = req.body;

      if (!photoUrl || !fileName) {
        return res.status(400).json({ error: 'Photo URL and filename are required' });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizePhotoPath(photoUrl);

      const photoData = {
        userId,
        photoUrl: normalizedPath,
        fileName,
        isPrimary: isPrimary || false,
      };

      const photo = await storage.addUserPhoto(photoData);
      res.json({ photo });
    } catch (error) {
      console.error('Add user photo error:', error);
      res.status(400).json({ error: 'Failed to add photo' });
    }
  });

  app.get('/api/users/:userId/photos', async (req, res) => {
    try {
      const { userId } = req.params;
      const photos = await storage.getUserPhotos(userId);
      res.json({ photos });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user photos' });
    }
  });

  app.delete('/api/users/:userId/photos/:photoId', async (req, res) => {
    try {
      const { userId, photoId } = req.params;
      await storage.deleteUserPhoto(photoId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete photo' });
    }
  });

  app.put('/api/users/:userId/photos/:photoId/primary', async (req, res) => {
    try {
      const { userId, photoId } = req.params;
      await storage.setPrimaryPhoto(photoId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to set primary photo' });
    }
  });

  // Search routes
  app.get('/api/search/messages', async (req, res) => {
    try {
      const { q: query, roomId, userId, limit } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const results = await storage.searchMessages(
        query,
        roomId as string,
        userId as string,
        limit ? parseInt(limit as string) : 20
      );

      res.json({ results });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  });

  app.get('/api/search/users', async (req, res) => {
    try {
      const { q: query, currentUserId, limit } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const results = await storage.searchUsers(
        query,
        currentUserId as string,
        limit ? parseInt(limit as string) : 20
      );

      res.json({ results });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  app.get('/api/search/rooms', async (req, res) => {
    try {
      const { q: query, userId, limit } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const results = await storage.searchRooms(
        query,
        userId as string,
        limit ? parseInt(limit as string) : 20
      );

      res.json({ results });
    } catch (error) {
      console.error('Search rooms error:', error);
      res.status(500).json({ error: 'Failed to search rooms' });
    }
  });

  // Room routes
  app.get('/api/rooms', async (req, res) => {
    try {
      const rooms = await storage.getRooms();
      res.json({ rooms });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      const roomData = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(roomData);
      res.json({ room });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create room' });
    }
  });

  app.get('/api/rooms/:id', async (req, res) => {
    try {
      const room = await storage.getRoomWithMembers(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json({ room });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  app.post('/api/rooms/:id/join', async (req, res) => {
    try {
      const { userId } = req.body;
      const roomId = req.params.id;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if room exists
      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const isAlreadyMember = await storage.isUserInRoom(roomId, userId);
      if (!isAlreadyMember) {
        await storage.addRoomMember({ roomId, userId });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Room join error:', error);
      res.status(400).json({ error: 'Failed to join room' });
    }
  });

  app.post('/api/rooms/:id/leave', async (req, res) => {
    try {
      const { userId } = req.body;
      const roomId = req.params.id;

      await storage.removeRoomMember(roomId, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to leave room' });
    }
  });


  // Message routes
  app.get('/api/rooms/:id/messages', async (req, res) => {
    try {
      const { limit, before, after } = req.query;
      const pagination = {
        limit: limit ? parseInt(limit as string) : 20, // Default to 20 messages
        before: before as string,
        after: after as string,
      };

      const result = await storage.getRoomMessages(req.params.id, pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/rooms/:id/messages/initial', async (req, res) => {
    try {
      const { limit } = req.query;
      const pagination = {
        limit: limit ? parseInt(limit as string) : 20, // Default to 20 messages
      };

      const result = await storage.getRoomMessages(req.params.id, pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch initial messages' });
    }
  });

  // Get messages since a specific timestamp (for smart reconnection)
  app.get('/api/rooms/:id/messages/since', async (req, res) => {
    try {
      const { timestamp, limit } = req.query;

      if (!timestamp) {
        return res.status(400).json({ error: 'Timestamp parameter is required' });
      }

      const pagination = {
        limit: limit ? parseInt(limit as string) : 100, // Higher limit for missed messages
        after: timestamp as string,
      };

      const result = await storage.getRoomMessages(req.params.id, pagination);
      console.log(`[API] Fetched ${result.items.length} messages since ${timestamp} for room ${req.params.id}`);
      res.json(result);
    } catch (error) {
      console.error('Error fetching messages since timestamp:', error);
      res.status(500).json({ error: 'Failed to fetch messages since timestamp' });
    }
  });

  // Admin get all rooms endpoint
  app.get('/api/admin/rooms', async (req, res) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId as string);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const rooms = await storage.getRooms();
      res.json({ rooms });
    } catch (error) {
      console.error('Get admin rooms error:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // Admin create room endpoint
  app.post('/api/admin/rooms', async (req, res) => {
    try {
      const { adminUserId, name, description, isPrivate = false } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const roomData = {
        name,
        description: description || '',
        isPrivate,
        memberIds: [],
        createdBy: adminUserId
      };

      const room = await storage.createRoom(roomData);
      res.json({ room, message: 'Room created successfully' });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // Admin delete room endpoint
  app.delete('/api/admin/rooms/:id', async (req, res) => {
    try {
      const { adminUserId } = req.body;
      const roomId = req.params.id;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      const success = await storage.deleteRoom(roomId, adminUserId);

      if (success) {
        res.json({ success: true, message: 'Room deleted successfully' });
      } else {
        res.status(404).json({ error: 'Room not found' });
      }
    } catch (error) {
      console.error('Delete room error:', error);
      if (error instanceof Error && error.message.includes('Access denied')) {
        res.status(403).json({ error: 'Admin privileges required' });
      } else {
        res.status(500).json({ error: 'Failed to delete room' });
      }
    }
  });

  // Admin clear all messages endpoint
  app.delete('/api/admin/messages', async (req, res) => {
    try {
      const { adminUserId } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const success = await storage.clearAllMessages();

      if (success) {
        res.json({ success: true, message: 'All messages cleared successfully' });
      } else {
        res.status(500).json({ error: 'Failed to clear messages' });
      }
    } catch (error) {
      console.error('Clear messages error:', error);
      res.status(500).json({ error: 'Failed to clear messages' });
    }
  });

  // Admin get all users endpoint
  app.get('/api/admin/users', async (req, res) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId as string);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      // Get all users for admin view
      const allUsers = await storage.getAllUsers();
      res.json({ users: allUsers });
    } catch (error) {
      console.error('Get admin users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Profile settings routes
  app.get('/api/users/:userId/profile-settings', async (req, res) => {
    try {
      const { userId } = req.params;
      const profileSettings = await storage.getUserProfileSettings(userId);
      res.json(profileSettings);
    } catch (error) {
      console.error('Get profile settings error:', error);
      res.status(500).json({ error: 'Failed to fetch profile settings' });
    }
  });

  app.put('/api/users/:userId/profile', async (req, res) => {
    try {
      const { userId } = req.params;
      const profileData = updateUserProfileSchema.parse(req.body);

      const updatedUser = await storage.updateUserProfile(userId, profileData);
      res.json({ user: updatedUser });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({ error: 'Failed to update profile' });
    }
  });

  // GDPR-compliant account deletion endpoint
  app.delete('/api/users/:userId/account', async (req, res) => {
    try {
      const { userId } = req.params;
      const { confirmPassword } = req.body;

      console.log(`[API] Account deletion requested for user: ${userId}`);

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // For security, require password confirmation (optional enhancement)
      if (confirmPassword) {
        const bcrypt = require('bcryptjs');
        const isValidPassword = await bcrypt.compare(confirmPassword, user.password);
        if (!isValidPassword) {
          return res.status(403).json({ error: 'Invalid password confirmation' });
        }
      }

      // Get user photos for object storage cleanup
      const userPhotos = await storage.getUserPhotos(userId);

      // Perform GDPR-compliant account deletion
      const deletionResult = await storage.deleteUserAccount(userId);

      // Clean up photos from object storage
      if (userPhotos.length > 0) {
        console.log(`[API] Cleaning up ${userPhotos.length} photos from object storage`);
        const objectStorage = new ObjectStorageService();

        for (const photo of userPhotos) {
          try {
            // TODO: Implement deleteFile method in ObjectStorageService
            console.log(`[API] Would delete photo from storage: ${photo.fileName}`);
            console.log(`[API] Deleted photo from storage: ${photo.fileName}`);
          } catch (error) {
            console.error(`[API] Failed to delete photo from storage: ${photo.fileName}`, error);
            // Continue with other photos even if one fails
          }
        }
      }

      // Disconnect user from WebSocket if they're connected
      if (clients.has(userId)) {
        const clientSet = clients.get(userId);
        if (clientSet) {
          // Remove user from all rooms they're in and close all connections
          for (const client of clientSet) {
            if (client.roomId) {
              removeUserFromRoom(client.roomId, userId);
            }
            try {
              client.close(1000, 'Account deleted');
            } catch (error) {
              console.error(`Failed to close connection for deleted user ${userId}:`, error);
            }
          }
        }
        clients.delete(userId);
      }

      console.log(`[API] Account deletion completed for user: ${user.username}`);
      console.log(`[API] Deletion summary:`, deletionResult.deletedData);

      res.json({ 
        success: true, 
        message: 'Account successfully deleted according to GDPR requirements',
        deletedData: deletionResult.deletedData
      });

    } catch (error) {
      console.error('Account deletion error:', error);

      // Return appropriate error message
      if ((error as Error).message === 'User not found') {
        res.status(404).json({ error: 'User not found' });
      } else if ((error as Error).message.includes('administrator')) {
        res.status(403).json({ error: 'Cannot delete administrator account' });
      } else {
        res.status(500).json({ error: 'Failed to delete account. Please try again later.' });
      }
    }
  });

  // Get user notification settings
  app.get('/api/users/:userId/notification-settings', async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getUserNotificationSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error('Get notification settings error:', error);
      res.status(500).json({ error: 'Failed to get notification settings' });
    }
  });

  // Update user notification settings
  app.put('/api/users/:userId/notification-settings', async (req, res) => {
    try {
      const { userId } = req.params;
      const settingsData = updateNotificationSettingsSchema.parse(req.body);

      const updatedSettings = await storage.updateUserNotificationSettings(userId, settingsData);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Update notification settings error:', error);
      res.status(400).json({ error: 'Failed to update notification settings' });
    }
  });

  // Get user notifications
  app.get('/api/users/:userId/notifications', async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const notifications = await storage.getUserNotifications(userId, limit, offset);

      res.json({
        notifications,
        hasMore: notifications.length === limit
      });
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Get unread notification count
  app.get('/api/users/:userId/notifications/unread-count', async (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = await storage.getUserNotifications(userId, 1000, 0);
      const unreadCount = notifications.filter(n => !n.read).length;

      res.json({ count: unreadCount });
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;

      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Friend system routes
  app.post('/api/friend-requests', async (req, res) => {
    try {
      const requestData = insertFriendRequestSchema.parse(req.body);

      if (requestData.senderId === requestData.receiverId) {
        return res.status(400).json({ error: 'Cannot send friend request to yourself' });
      }

      const friendRequest = await storage.sendFriendRequest(requestData.senderId, requestData.receiverId);
      res.json({ friendRequest });
    } catch (error: any) {
      console.error('Send friend request error:', error);
      res.status(400).json({ error: error.message || 'Failed to send friend request' });
    }
  });

  app.get('/api/users/:userId/friend-requests', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`[API] Fetching friend requests for user: ${userId}`);
      const friendRequests = await storage.getFriendRequests(userId);
      console.log(`[API] Returning ${friendRequests.length} friend requests for user ${userId}`);
      res.json({ friendRequests });
    } catch (error) {
      console.error('Get friend requests error:', error);
      res.status(500).json({ error: 'Failed to fetch friend requests' });
    }
  });

  app.get('/api/users/:userId/sent-friend-requests', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`[API] Fetching sent friend requests for user: ${userId}`);
      const sentFriendRequests = await storage.getSentFriendRequests(userId);
      console.log(`[API] Returning ${sentFriendRequests.length} sent friend requests for user ${userId}`);
      res.json({ sentFriendRequests });
    } catch (error) {
      console.error('Get sent friend requests error:', error);
      res.status(500).json({ error: 'Failed to fetch sent friend requests' });
    }
  });

  app.put('/api/friend-requests/:requestId', async (req, res) => {
    try {
      const { requestId } = req.params;
      const actionData = friendRequestActionSchema.parse(req.body);

      const success = await storage.respondToFriendRequest(requestId, actionData.action);
      res.json({ success });
    } catch (error: any) {
      console.error('Respond to friend request error:', error);
      res.status(400).json({ error: error.message || 'Failed to respond to friend request' });
    }
  });

  app.delete('/api/friend-requests/:requestId/cancel/:userId', async (req, res) => {
    try {
      const { requestId, userId } = req.params;

      const success = await storage.cancelFriendRequest(requestId, userId);
      res.json({ success });
    } catch (error: any) {
      console.error('Cancel friend request error:', error);
      res.status(400).json({ error: error.message || 'Failed to cancel friend request' });
    }
  });

  app.get('/api/users/:userId/friends', async (req, res) => {
    try {
      const { userId } = req.params;
      const friends = await storage.getFriends(userId);
      res.json({ friends });
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ error: 'Failed to fetch friends' });
    }
  });

  app.delete('/api/users/:userId/friends/:friendId', async (req, res) => {
    try {
      const { userId, friendId } = req.params;
      const success = await storage.removeFriend(userId, friendId);
      res.json({ success });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ error: 'Failed to remove friend' });
    }
  });

  app.get('/api/users/:userId/friendship-status/:otherUserId', async (req, res) => {
    try {
      const { userId, otherUserId } = req.params;
      const status = await storage.getFriendshipStatus(userId, otherUserId);
      res.json({ status });
    } catch (error) {
      console.error('Get friendship status error:', error);
      res.status(500).json({ error: 'Failed to get friendship status' });
    }
  });

  // Privacy settings routes  
  app.get('/api/users/:userId/privacy-settings', async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getUserPrivacySettings(userId);
      res.json(settings);
    } catch (error) {
      console.error('Get privacy settings error:', error);
      res.status(500).json({ error: 'Failed to get privacy settings' });
    }
  });

  app.put('/api/users/:userId/privacy-settings', async (req, res) => {
    try {
      const { userId } = req.params;
      const settingsData = updatePrivacySettingsSchema.parse(req.body);

      const updatedSettings = await storage.updateUserPrivacySettings(userId, settingsData);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(400).json({ error: 'Failed to update privacy settings' });
    }
  });

  // Blocked users routes
  app.post('/api/users/:userId/blocked-users', async (req, res) => {
    try {
      const { userId } = req.params;
      const { blockedId, reason } = req.body;

      if (!blockedId) {
        return res.status(400).json({ error: 'Blocked user ID is required' });
      }

      if (userId === blockedId) {
        return res.status(400).json({ error: 'Cannot block yourself' });
      }

      // Check if already blocked
      const isAlreadyBlocked = await storage.isUserBlocked(userId, blockedId);
      if (isAlreadyBlocked) {
        return res.status(400).json({ error: 'User is already blocked' });
      }

      const blockData = insertBlockedUserSchema.parse({
        blockerId: userId,
        blockedId,
        reason: reason || null,
      });

      const blockedUser = await storage.blockUser(blockData);
      res.json({ blockedUser });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(400).json({ error: 'Failed to block user' });
    }
  });

  app.delete('/api/users/:userId/blocked-users/:blockedId', async (req, res) => {
    try {
      const { userId, blockedId } = req.params;

      await storage.unblockUser(userId, blockedId);
      res.json({ success: true });
    } catch (error) {
      console.error('Unblock user error:', error);
      res.status(400).json({ error: 'Failed to unblock user' });
    }
  });

  app.get('/api/users/:userId/blocked-users', async (req, res) => {
    try {
      const { userId } = req.params;
      const blockedUsers = await storage.getBlockedUsers(userId);
      res.json(blockedUsers);
    } catch (error) {
      console.error('Get blocked users error:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  // Report routes
  app.post('/api/reports', async (req, res) => {
    try {
      // Get the reporter's user ID from a session or auth token
      // For now, assuming it's passed in the request body
      const { reportedUserId, reason, description, reporterId } = req.body;

      if (!reporterId) {
        return res.status(401).json({ error: 'Reporter ID is required' });
      }

      const reportData = reportSchema.parse({
        reportedUserId,
        reason,
        description,
      });

      if (reporterId === reportedUserId) {
        return res.status(400).json({ error: 'Cannot report yourself' });
      }

      // Check if users exist
      const reporter = await storage.getUser(reporterId);
      const reportedUser = await storage.getUser(reportedUserId);

      if (!reporter || !reportedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const insertData = insertReportSchema.parse({
        reporterId,
        reportedUserId: reportData.reportedUserId,
        reason: reportData.reason,
        description: reportData.description,
        status: 'pending',
      });

      const report = await storage.createReport(insertData);
      res.json({ report });
    } catch (error) {
      console.error('Create report error:', error);
      res.status(400).json({ error: 'Failed to create report' });
    }
  });

  app.get('/api/admin/reports', async (req, res) => {
    try {
      // Get the admin user ID from session/auth
      // For now, checking if user has admin role
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      const reports = await storage.getReports(adminUserId as string);
      res.json({ reports });
    } catch (error) {
      console.error('Get reports error:', error);
      if (error instanceof Error && error.message?.includes('Access denied')) {
        res.status(403).json({ error: 'Admin privileges required' });
      } else {
        res.status(500).json({ error: 'Failed to fetch reports' });
      }
    }
  });


  app.put('/api/admin/reports/:reportId/status', async (req, res) => {
    try {
      const { reportId } = req.params;
      const { adminUserId, ...statusUpdate } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      const validatedStatusUpdate = updateReportStatusSchema.parse(statusUpdate);
      const updatedReport = await storage.updateReportStatus(reportId, validatedStatusUpdate, adminUserId);

      res.json({ report: updatedReport });
    } catch (error) {
      console.error('Update report status error:', error);
      if (error instanceof Error && error.message?.includes('Access denied')) {
        res.status(403).json({ error: 'Admin privileges required' });
      } else {
        res.status(400).json({ error: 'Failed to update report status' });
      }
    }
  });

  app.get('/api/reports/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { requesterId } = req.query;

      if (!requesterId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if requester is admin
      const requester = await storage.getUser(requesterId as string);
      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const userReports = await storage.getUserReports(userId);
      res.json({ reports: userReports });
    } catch (error) {
      console.error('Get user reports error:', error);
      res.status(500).json({ error: 'Failed to fetch user reports' });
    }
  });

  // Admin Dashboard Routes
  app.get('/api/admin/dashboard-stats', async (req, res) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId as string);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const stats = await storage.getAdminDashboardStats();
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get('/api/admin/moderation-data', async (req, res) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId as string);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const moderationData = await storage.getModerationData(adminUserId as string);
      res.json(moderationData);
    } catch (error) {
      console.error('Error fetching moderation data:', error);
      res.status(500).json({ error: 'Failed to fetch moderation data' });
    }
  });

  app.get('/api/admin/banned-users', async (req, res) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId as string);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const bannedUsers = await storage.getBannedUsers();
      res.json({ users: bannedUsers });
    } catch (error) {
      console.error('Error fetching banned users:', error);
      res.status(500).json({ error: 'Failed to fetch banned users' });
    }
  });

  app.post('/api/admin/warn-user', async (req, res) => {
    try {
      const adminUserId = req.headers.adminuserid as string || '7a6dab62-7327-4f79-b025-952b687688c1';
      const warnData = warnUserSchema.parse(req.body);
      const action = await storage.warnUser(warnData, adminUserId);
      res.json({ action });
    } catch (error) {
      console.error('Error warning user:', error);
      res.status(500).json({ error: 'Failed to warn user' });
    }
  });

  app.post('/api/admin/ban-user', async (req, res) => {
    try {
      const adminUserId = req.headers.adminuserid as string || '7a6dab62-7327-4f79-b025-952b687688c1';
      const banData = banUserSchema.parse(req.body);
      const result = await storage.banUser(banData, adminUserId);
      res.json(result);
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  });

  app.post('/api/admin/unban-user', async (req, res) => {
    try {
      const adminUserId = req.headers.adminuserid as string || '7a6dab62-7327-4f79-b025-952b687688c1';
      const { userId, reason } = req.body;
      const result = await storage.unbanUser(userId, adminUserId, reason || 'Unbanned by admin');
      res.json(result);
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  });

  // Admin block user endpoint
  app.post('/api/admin/block-user', async (req, res) => {
    try {
      const { adminUserId, userId, reason } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const blockData = {
        blockerId: adminUserId,
        blockedId: userId,
        reason: reason || 'Blocked by admin'
      };

      const blockedUser = await storage.blockUser(blockData);
      res.json({ success: true, blockedUser, message: 'User blocked successfully' });
    } catch (error: any) {
      console.error('Block user error:', error);
      res.status(500).json({ error: error.message || 'Failed to block user' });
    }
  });

  // Admin unblock user endpoint
  app.post('/api/admin/unblock-user', async (req, res) => {
    try {
      const { adminUserId, userId } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const success = await storage.unblockUser(adminUserId, userId);

      if (success) {
        res.json({ success: true, message: 'User unblocked successfully' });
      } else {
        res.status(404).json({ error: 'Block relationship not found' });
      }
    } catch (error: any) {
      console.error('Unblock user error:', error);
      res.status(500).json({ error: error.message || 'Failed to unblock user' });
    }
  });

  // Admin ban user endpoint
  app.post('/api/admin/ban-user', async (req, res) => {
    try {
      const { adminUserId, userId, reason } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      // Prevent admin from banning themselves
      if (adminUserId === userId) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }

      const banData = {
        userId,
        reason: reason || 'Banned by admin',
        permanent: true
      };

      const result = await storage.banUser(banData, adminUserId);
      res.json({ success: true, result, message: 'User banned successfully' });
    } catch (error: any) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: error.message || 'Failed to ban user' });
    }
  });

  // Admin unban user endpoint
  app.post('/api/admin/unban-user', async (req, res) => {
    try {
      const { adminUserId, userId } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Verify admin privileges
      const adminUser = await storage.getUser(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      const result = await storage.unbanUser(userId, adminUserId, 'Unbanned by admin');
      res.json({ success: true, result, message: 'User unbanned successfully' });
    } catch (error: any) {
      console.error('Unban user error:', error);
      res.status(500).json({ error: error.message || 'Failed to unban user' });
    }
  });

  app.get('/api/admin/user/:userId/moderation-history', async (req, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getUserModerationHistory(userId);
      res.json({ history });
    } catch (error) {
      console.error('Error fetching user moderation history:', error);
      res.status(500).json({ error: 'Failed to fetch moderation history' });
    }
  });

  // Manual cleanup endpoint for admins
  app.post('/api/admin/cleanup-messages', async (req: Request, res: Response) => {
    try {
      const { adminUserId } = req.body;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Check if user is admin
      const user = await storage.getUser(adminUserId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admin privileges required' });
      }

      const { cleanupScheduler } = await import('./cleanup-scheduler');
      const result = await cleanupScheduler.runCleanupNow();

      res.json({
        success: true,
        message: 'Message cleanup completed successfully',
        result: {
          totalDeleted: result.totalDeleted,
          roomsCleaned: result.roomsCleaned
        }
      });
    } catch (error: any) {
      console.error('Manual cleanup error:', error);
      if ((error as Error).message === 'Cleanup is already in progress') {
        return res.status(409).json({ error: 'Cleanup is already in progress' });
      }
      res.status(500).json({ error: (error as Error).message || 'Failed to run message cleanup' });
    }
  });

  // Cleanup status endpoint for admins
  app.get('/api/admin/cleanup-status', async (req: Request, res: Response) => {
    try {
      const { adminUserId } = req.query;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }

      // Check if user is admin
      const user = await storage.getUser(adminUserId as string);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admin privileges required' });
      }

      const { cleanupScheduler } = await import('./cleanup-scheduler');
      const status = cleanupScheduler.getStatus();

      res.json({
        success: true,
        status
      });
    } catch (error: any) {
      console.error('Cleanup status error:', error);
      res.status(500).json({ error: error.message || 'Failed to get cleanup status' });
    }
  });

  return httpServer;
}