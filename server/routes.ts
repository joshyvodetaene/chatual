import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertRoomSchema, insertMessageSchema, registerUserSchema, loginSchema, insertUserPhotoSchema, updateUserProfileSchema, insertBlockedUserSchema, insertReportSchema, reportSchema, updateReportStatusSchema, warnUserSchema, banUserSchema, updateNotificationSettingsSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { NotificationService } from "./notification-service";

interface WebSocketClient extends WebSocket {
  userId?: string;
  roomId?: string;
  isAlive?: boolean;
  lastActivity?: number;
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
    path: '/ws',
    perMessageDeflate: false,
    maxPayload: 16 * 1024,
  });
  const clients = new Map<string, WebSocketClient>();
  const roomUsers = new Map<string, Set<string>>(); // Track online users per room
  
  // Initialize notification service
  const notificationService = new NotificationService(clients);
  
  console.log('WebSocket server initialized on path /ws');

  // Connection health tracking constants
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const CONNECTION_TIMEOUT = 60000; // 60 seconds
  const CLEANUP_INTERVAL = 45000; // 45 seconds

  // Enhanced connection validation function
  function isConnectionAlive(client: WebSocketClient): boolean {
    const now = Date.now();
    return client.readyState === WebSocket.OPEN && 
           client.isAlive === true && 
           (!client.lastActivity || (now - client.lastActivity) < CONNECTION_TIMEOUT);
  }

  // Clean up stale connections and room users
  function cleanupStaleConnections() {
    console.log('[WS_CLEANUP] Starting periodic cleanup of stale connections');
    const now = Date.now();
    let cleanedConnections = 0;
    let cleanedRoomEntries = 0;

    // Clean up stale clients
    for (const [userId, client] of clients.entries()) {
      if (!isConnectionAlive(client)) {
        console.log(`[WS_CLEANUP] Removing stale connection for user ${userId}`);
        
        // Remove from room if they were in one
        if (client.roomId && client.userId) {
          removeUserFromRoom(client.roomId, client.userId);
          cleanedRoomEntries++;
        }
        
        // Update database status and remove client
        if (client.userId) {
          storage.updateUserOnlineStatus(client.userId, false).catch(error => {
            console.error(`[WS_CLEANUP] Failed to update user status for ${client.userId}:`, error);
          });
        }
        
        clients.delete(userId);
        cleanedConnections++;
        
        try {
          client.close(1001, 'Connection cleanup');
        } catch (error) {
          // Connection might already be closed
        }
      }
    }

    // Validate room users against actual connections
    for (const [roomId, userSet] of roomUsers.entries()) {
      const validUsers = new Set<string>();
      
      for (const userId of userSet) {
        const client = clients.get(userId);
        if (client && isConnectionAlive(client) && client.roomId === roomId) {
          validUsers.add(userId);
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

    for (const [userId, client] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        // Mark as potentially stale
        client.isAlive = false;
        
        try {
          client.ping((error: Error | null) => {
            if (error) {
              console.log(`[WS_HEARTBEAT] Ping failed for user ${userId}: ${error.message}`);
              staleConnections++;
            }
          });
          activeConnections++;
        } catch (error) {
          console.log(`[WS_HEARTBEAT] Failed to ping user ${userId}: ${error}`);
          staleConnections++;
        }
      } else {
        staleConnections++;
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
    for (const [userId, client] of clients.entries()) {
      try {
        client.close(1001, 'Server shutdown');
      } catch (error) {
        console.error(`[WS_SHUTDOWN] Error closing connection for user ${userId}:`, error);
      }
    }
    clients.clear();
    roomUsers.clear();
  };

  // Handle graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGUSR2', cleanup); // For nodemon restarts

  // Helper function to broadcast to room
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    let sentCount = 0;
    Array.from(clients.values()).forEach(client => {
      if (client.roomId === roomId && client.readyState === WebSocket.OPEN && client.userId !== excludeUserId) {
        try {
          client.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send message to user ${client.userId}:`, error);
        }
      }
    });
  }

  // Helper function to broadcast to specific user
  function broadcastToUser(userId: string, message: any) {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    } else {
      return false;
    }
  }

  // Helper functions for room user management
  function addUserToRoom(roomId: string, userId: string) {
    // Validate that the user actually has an active connection
    const client = clients.get(userId);
    if (!client || !isConnectionAlive(client)) {
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
      const client = clients.get(userId);
      if (client && isConnectionAlive(client) && client.roomId === roomId) {
        validUsers.add(userId);
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

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('[WS_CONNECTION] New WebSocket connection established');
    
    // Initialize connection tracking
    ws.isAlive = true;
    ws.lastActivity = Date.now();
    
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
            // Remove user from previous room if any
            if (ws.roomId && ws.userId) {
              removeUserFromRoom(ws.roomId, ws.userId);
            }
            
            // Check if user already has a connection and close it
            const existingConnection = clients.get(message.userId);
            if (existingConnection && existingConnection !== ws) {
              existingConnection.close();
              clients.delete(message.userId);
            }
            
            ws.userId = message.userId;
            ws.roomId = message.roomId;
            
            // Initialize or reset connection tracking for this user
            ws.isAlive = true;
            ws.lastActivity = Date.now();
            
            clients.set(message.userId, ws);
            
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

          case 'message':
            console.log(`[WEBSOCKET] Processing message from userId=${ws.userId}, roomId=${ws.roomId}`);
            if (ws.userId && ws.roomId) {
              console.log(`[WEBSOCKET] Message content length: ${message.content?.length || 0}, messageType: ${message.messageType}`);
              
              // Normalize photo URL if this is a photo message
              let normalizedPhotoUrl = message.photoUrl;
              if (message.photoUrl && message.messageType === 'photo') {
                console.log(`[WEBSOCKET] Normalizing photo URL: ${message.photoUrl}`);
                const objectStorageService = new ObjectStorageService();
                normalizedPhotoUrl = objectStorageService.normalizePhotoPath(message.photoUrl);
                console.log(`[WEBSOCKET] Normalized photo URL: ${normalizedPhotoUrl}`);
              }
              
              console.log(`[WEBSOCKET] Creating message in storage...`);
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                roomId: ws.roomId,
                photoUrl: normalizedPhotoUrl,
                photoFileName: message.photoFileName,
                messageType: message.messageType || 'text',
                mentionedUserIds: message.mentionedUserIds || [],
              });
              
              console.log('[WEBSOCKET] Created message:', {
                id: newMessage.id,
                messageType: newMessage.messageType,
                photoUrl: newMessage.photoUrl,
                photoFileName: newMessage.photoFileName
              });
              
              console.log(`[WEBSOCKET] Getting user data for ${ws.userId}`);
              const user = await storage.getUser(ws.userId);
              const messageWithUser = { ...newMessage, user };
              
              console.log('[WEBSOCKET] Broadcasting message:', {
                id: messageWithUser.id,
                messageType: messageWithUser.messageType,
                photoUrl: messageWithUser.photoUrl
              });
              
              // Send notifications for mentions
              if (newMessage.mentionedUserIds && newMessage.mentionedUserIds.length > 0) {
                console.log(`[WEBSOCKET] Processing mentions: ${newMessage.mentionedUserIds}`);
                for (const mentionedUserId of newMessage.mentionedUserIds) {
                  if (mentionedUserId !== ws.userId) { // Don't notify the sender
                    await notificationService.notifyMention(
                      mentionedUserId,
                      ws.userId,
                      ws.roomId,
                      newMessage.content || '[Photo]'
                    );
                  }
                }
              }

              // Send notifications to room members who are not currently online in this room
              try {
                const roomMembers = await storage.getRoomMembers(ws.roomId);
                const onlineUsersInRoom = Array.from(roomUsers.get(ws.roomId) || []);
                
                for (const member of roomMembers) {
                  // Don't notify the sender and those who are currently online in the room
                  if (member.id !== ws.userId && !onlineUsersInRoom.includes(member.id)) {
                    const isDirectMessage = roomMembers.length === 2; // Simple check for direct messages
                    await notificationService.notifyNewMessage(
                      member.id,
                      ws.userId,
                      ws.roomId,
                      newMessage.content || '[Photo]',
                      isDirectMessage
                    );
                  }
                }
              } catch (error) {
                console.error('Error sending message notifications:', error);
              }
              
              // Broadcast message to room
              broadcastToRoom(ws.roomId, {
                type: 'new_message',
                message: messageWithUser,
              });
            } else {
              console.log(`[WEBSOCKET] Cannot process message: missing userId=${ws.userId} or roomId=${ws.roomId}`);
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
      
      if (ws.userId && ws.roomId) {
        console.log(`[WS_CLOSE] Cleaning up user ${ws.userId} from room ${ws.roomId}`);
        
        // Remove user from room and update online status
        removeUserFromRoom(ws.roomId, ws.userId);
        
        try {
          await storage.updateUserOnlineStatus(ws.userId, false);
        } catch (error) {
          console.error(`[WS_CLOSE] Failed to update offline status for user ${ws.userId}:`, error);
        }
        
        // Broadcast user left
        broadcastToRoom(ws.roomId, {
          type: 'user_left',
          userId: ws.userId,
        });
        
        clients.delete(ws.userId);
        
        // Synchronize room users to ensure accuracy after disconnect
        synchronizeRoomUsers(ws.roomId);
      } else if (ws.userId) {
        // User connected but not in a room, still need to clean up
        console.log(`[WS_CLOSE] Cleaning up user ${ws.userId} (not in room)`);
        clients.delete(ws.userId);
        
        try {
          await storage.updateUserOnlineStatus(ws.userId, false);
        } catch (error) {
          console.error(`[WS_CLOSE] Failed to update offline status for user ${ws.userId}:`, error);
        }
      }
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
            displayName: user1.displayName,
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
      
      const success = await storage.deletePrivateRoom(roomId, userId);
      if (success) {
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

  // Serve photos
  app.get('/photos/:photoPath(*)', async (req, res) => {
    const photoPath = '/photos/' + req.params.photoPath;
    const objectStorageService = new ObjectStorageService();
    try {
      console.log('Serving photo:', photoPath);
      const photoFile = await objectStorageService.getPhotoFile(photoPath);
      objectStorageService.downloadObject(photoFile, res);
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

  // Reaction routes
  app.post('/api/messages/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { userId, emoji } = req.body;
      
      if (!userId || !emoji) {
        return res.status(400).json({ error: 'User ID and emoji are required' });
      }
      
      const reaction = await storage.addReaction({ messageId, userId, emoji });
      
      // Send notification to the message author (if it's not the same person reacting)
      try {
        const message = await storage.getMessageById(messageId);
        if (message && message.userId !== userId) {
          // Get room ID from the message to include in notification metadata
          await notificationService.notifyReaction(
            message.userId,
            userId,
            emoji,
            message.roomId
          );
        }
      } catch (notificationError) {
        console.error('Error sending reaction notification:', notificationError);
        // Don't fail the request if notification fails
      }
      
      res.json({ reaction });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  });
  
  app.delete('/api/messages/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { userId, emoji } = req.body;
      
      if (!userId || !emoji) {
        return res.status(400).json({ error: 'User ID and emoji are required' });
      }
      
      const success = await storage.removeReaction(messageId, userId, emoji);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Reaction not found' });
      }
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json({ error: 'Failed to remove reaction' });
    }
  });
  
  app.get('/api/messages/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { currentUserId } = req.query;
      
      const reactions = await storage.getMessageReactions(messageId, currentUserId as string);
      res.json({ reactions });
    } catch (error) {
      console.error('Get reactions error:', error);
      res.status(500).json({ error: 'Failed to get reactions' });
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
      
      // For now, return a simplified list of users for admin view
      const allUsers = await storage.getOnlineUsers();
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
      const { limit = '20', offset = '0' } = req.query;
      
      const notifications = await storage.getUserNotifications(userId, parseInt(limit as string), parseInt(offset as string));
      res.json({ notifications });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
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

  return httpServer;
}
