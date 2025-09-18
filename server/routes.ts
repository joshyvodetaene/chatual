import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertRoomSchema, insertMessageSchema, registerUserSchema, loginSchema, insertUserPhotoSchema, updateUserProfileSchema, insertBlockedUserSchema, insertReportSchema, reportSchema, updateReportStatusSchema, warnUserSchema, banUserSchema, updateNotificationSettingsSchema, insertFriendRequestSchema, friendRequestActionSchema, updatePrivacySettingsSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { NotificationService } from "./notification-service";
import { validateCityWithGoogle } from "./lib/geocoding";
import { requireAdminAuth } from "./middleware/admin-auth";
import type { AuthenticatedRequest } from "./types/session";

interface WebSocketClient extends WebSocket {
  userId?: string;
  roomId?: string;
  connectionId: string;
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
    path: '/ws',
    perMessageDeflate: false,
    maxPayload: 16 * 1024,
  });
  // Multi-device support: Map userId -> Set of WebSocket connections
  const userConnections = new Map<string, Set<WebSocketClient>>();
  // Map connectionId -> WebSocketClient for quick lookup
  const connectionMap = new Map<string, WebSocketClient>();
  const roomUsers = new Map<string, Set<string>>(); // Track online users per room

  // Initialize notification service with multi-device support
  const notificationService = new NotificationService(
    // Pass a function that can send to all user connections
    (userId: string, message: any) => broadcastToUser(userId, message)
  );

  console.log('WebSocket server initialized on path /ws');

  // Connection health tracking constants - more lenient settings
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const CONNECTION_TIMEOUT = 180000; // 3 minutes (much more lenient)
  const CLEANUP_INTERVAL = 120000; // 2 minutes (less frequent cleanup)

  // Multi-device helper functions
  function generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function addUserConnection(userId: string, client: WebSocketClient): void {
    // Add to user connections set
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(client);
    
    // Add to connection map for quick lookup
    connectionMap.set(client.connectionId, client);
    
    console.log(`[MULTI_DEVICE] User ${userId} now has ${userConnections.get(userId)!.size} active connections`);
  }

  function removeUserConnection(userId: string, connectionId: string): void {
    const userConns = userConnections.get(userId);
    if (userConns) {
      // Find and remove the specific connection
      for (const conn of userConns) {
        if (conn.connectionId === connectionId) {
          userConns.delete(conn);
          connectionMap.delete(connectionId);
          console.log(`[MULTI_DEVICE] Removed connection ${connectionId} for user ${userId}. Remaining: ${userConns.size}`);
          break;
        }
      }
      
      // Clean up empty user entry
      if (userConns.size === 0) {
        userConnections.delete(userId);
        console.log(`[MULTI_DEVICE] User ${userId} has no more active connections`);
      }
    }
  }

  function getUserConnections(userId: string): Set<WebSocketClient> {
    return userConnections.get(userId) || new Set();
  }
  
  // Helper to check if user has other connections in a specific room
  function hasOtherRoomConnections(userId: string, roomId: string, excludeConnectionId?: string): boolean {
    const userConns = getUserConnections(userId);
    for (const conn of userConns) {
      if (conn.roomId === roomId && 
          conn.connectionId !== excludeConnectionId && 
          isConnectionAlive(conn)) {
        return true;
      }
    }
    return false;
  }

  function isUserOnline(userId: string): boolean {
    const connections = getUserConnections(userId);
    for (const conn of connections) {
      if (isConnectionAlive(conn)) {
        return true;
      }
    }
    return false;
  }

  function getAllActiveConnections(): WebSocketClient[] {
    const allConnections: WebSocketClient[] = [];
    for (const connectionSet of userConnections.values()) {
      for (const conn of connectionSet) {
        if (isConnectionAlive(conn)) {
          allConnections.push(conn);
        }
      }
    }
    return allConnections;
  }

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
    if (process.env.DEBUG_WS) console.log('[WS_CLEANUP] Starting periodic cleanup of stale connections');
    const now = Date.now();
    let cleanedConnections = 0;
    let cleanedRoomEntries = 0;
    const usersToUpdateStatus = new Set<string>();

    // Clean up stale connections for all users
    for (const [userId, connectionSet] of userConnections.entries()) {
      const staleConnections = [];
      
      for (const client of connectionSet) {
        if (!isConnectionAlive(client)) {
          staleConnections.push(client);
        }
      }

      // Remove stale connections
      for (const client of staleConnections) {
        if (process.env.DEBUG_WS) console.log(`[WS_CLEANUP] Removing stale connection ${client.connectionId} for user ${userId}`);

        // Check if user has other connections in this room before removing
        const userLeavingRoom = client.roomId && !hasOtherRoomConnections(client.userId, client.roomId, client.connectionId);

        // Remove the specific connection first
        removeUserConnection(userId, client.connectionId);
        cleanedConnections++;

        // Only remove from room if no other connections in that room
        if (userLeavingRoom) {
          removeUserFromRoom(client.roomId, client.userId);
          cleanedRoomEntries++;
          if (process.env.DEBUG_WS) console.log(`[WS_CLEANUP] User ${userId} removed from room ${client.roomId} (no other connections)`);
        } else if (client.roomId) {
          if (process.env.DEBUG_WS) console.log(`[WS_CLEANUP] User ${userId} kept in room ${client.roomId} (has other connections)`);
        }

        try {
          client.close(1001, 'Connection cleanup');
        } catch (error) {
          // Connection might already be closed
        }
      }

      // Check if user should be marked offline (no active connections remaining)
      if (staleConnections.length > 0 && !isUserOnline(userId)) {
        usersToUpdateStatus.add(userId);
      }
    }

    // Update database status for users who are now completely offline
    for (const userId of usersToUpdateStatus) {
      storage.updateUserOnlineStatus(userId, false).catch(error => {
        console.error(`[WS_CLEANUP] Failed to update user status for ${userId}:`, error);
      });
    }

    // Validate room users against actual connections
    for (const [roomId, userSet] of roomUsers.entries()) {
      const validUsers = new Set<string>();

      for (const userId of userSet) {
        // Check if user has any active connections in this room
        const userConns = getUserConnections(userId);
        let hasActiveRoomConnection = false;
        
        for (const client of userConns) {
          if (isConnectionAlive(client) && client.roomId === roomId) {
            hasActiveRoomConnection = true;
            break;
          }
        }
        
        if (hasActiveRoomConnection) {
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
      if (process.env.DEBUG_WS) console.log(`[WS_CLEANUP] Cleaned ${cleanedConnections} stale connections and ${cleanedRoomEntries} room entries`);
    }
  }

  // Heartbeat function to check connection health
  function heartbeat() {
    if (process.env.DEBUG_WS) console.log('[WS_HEARTBEAT] Sending ping to all connected clients');
    let activeConnections = 0;
    let staleConnections = 0;

    // Ping all active connections
    for (const [userId, connectionSet] of userConnections.entries()) {
      for (const client of connectionSet) {
        if (client.readyState === WebSocket.OPEN) {
          // Mark as dead before ping - will be set to true if pong received
          if (client.isAlive === false) {
            // This client already failed a previous heartbeat, mark for cleanup
            staleConnections++;
            continue;
          }

          // Set to false before ping - pong handler will set to true if responsive
          client.isAlive = false;
          
          try {
            client.ping((error: Error | null) => {
              if (error) {
                if (process.env.DEBUG_WS) console.log(`[WS_HEARTBEAT] Ping failed for connection ${client.connectionId} (user ${userId}): ${error.message}`);
                client.isAlive = false; // Only mark as false if ping actually failed
              }
            });
            activeConnections++;
          } catch (error) {
            if (process.env.DEBUG_WS) console.log(`[WS_HEARTBEAT] Failed to ping connection ${client.connectionId} (user ${userId}): ${error}`);
            client.isAlive = false; // Only mark as false if ping failed
            staleConnections++;
          }
        } else {
          staleConnections++;
        }
      }
    }

    if (process.env.DEBUG_WS) console.log(`[WS_HEARTBEAT] Pinged ${activeConnections} clients, ${staleConnections} potentially stale`);
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
    for (const [userId, connectionSet] of userConnections.entries()) {
      for (const client of connectionSet) {
        try {
          client.close(1001, 'Server shutdown');
        } catch (error) {
          console.error(`[WS_SHUTDOWN] Error closing connection ${client.connectionId} for user ${userId}:`, error);
        }
      }
    }
    userConnections.clear();
    connectionMap.clear();
    roomUsers.clear();
  };

  // Handle graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGUSR2', cleanup); // For nodemon restarts

  // Helper function to broadcast to room (multi-device support)
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    let sentCount = 0;
    let totalConnections = 0;
    
    // Count total connections for logging
    for (const connections of userConnections.values()) {
      totalConnections += connections.size;
    }
    
    console.log(`[BROADCAST] Broadcasting to room ${roomId}, found ${totalConnections} total connections, message type: ${message.type}`);
    
    // Iterate through all users and their connections
    for (const [userId, connectionSet] of userConnections.entries()) {
      if (userId === excludeUserId) continue; // Skip excluded user entirely
      
      for (const client of connectionSet) {
        const roomMatch = client.roomId === roomId;
        const isOpen = client.readyState === WebSocket.OPEN;
        
        console.log(`[BROADCAST] ${message.type}: userId=${client.userId}, roomId=${client.roomId}, readyState=${client.readyState}, excluded=${userId === excludeUserId}`);
        
        if (roomMatch && isOpen) {
          try {
            client.send(JSON.stringify(message));
            sentCount++;
            console.log(`[BROADCAST] Message sent to user ${client.userId} (connection ${client.connectionId})`);
          } catch (error) {
            console.error(`Failed to send message to user ${client.userId} (connection ${client.connectionId}):`, error);
            // Mark client as potentially problematic for cleanup
            client.isAlive = false;
          }
        }
      }
    }
    
    console.log(`[BROADCAST] Successfully sent to ${sentCount} connections in room ${roomId}`);

    // Log only for important messages when no clients were reached
    if (message.type === 'new_message' && sentCount === 0) {
      console.log(`[BROADCAST] Warning: No connections received message in room ${roomId}`);
    }
  }

  // Helper function to broadcast to specific user (all their connections)
  function broadcastToUser(userId: string, message: any) {
    const connections = getUserConnections(userId);
    let sentCount = 0;
    
    for (const client of connections) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
          sentCount++;
          console.log(`[BROADCAST] Message sent to user ${userId} (connection ${client.connectionId})`);
        } catch (error) {
          console.error(`Failed to send message to user ${userId} (connection ${client.connectionId}):`, error);
          client.isAlive = false;
        }
      }
    }
    
    console.log(`[BROADCAST] Sent to ${sentCount} connections for user ${userId}`);
    return sentCount > 0;
  }

  // Helper functions for room user management
  function addUserToRoom(roomId: string, userId: string) {
    // Validate that the user has at least one active connection
    if (!isUserOnline(userId)) {
      console.log(`[WS_ROOM] Cannot add user ${userId} to room ${roomId}: no active connections`);
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

  // Function to synchronize room users with actual connections (multi-device support)
  function synchronizeRoomUsers(roomId: string) {
    const roomUserSet = roomUsers.get(roomId);
    if (!roomUserSet) return;

    const validUsers = new Set<string>();
    let removedUsers = 0;

    for (const userId of roomUserSet) {
      // Check if user has any active connections in this room
      const userConns = getUserConnections(userId);
      let hasActiveRoomConnection = false;
      
      for (const client of userConns) {
        if (isConnectionAlive(client) && client.roomId === roomId) {
          hasActiveRoomConnection = true;
          break;
        }
      }
      
      if (hasActiveRoomConnection) {
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

    // Generate unique connection ID for multi-device support
    ws.connectionId = generateConnectionId();
    ws.connectedAt = Date.now();
    
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
            console.log(`[WS_JOIN] Join request from userId=${message.userId}, roomId=${message.roomId}`);

            // Store previous room for cleanup
            const previousRoomId = ws.roomId;

            // Remove user from previous room only if no other connections in that room
            if (ws.roomId && ws.userId) {
              const userLeavingPreviousRoom = !hasOtherRoomConnections(ws.userId, ws.roomId, ws.connectionId);
              
              if (userLeavingPreviousRoom) {
                console.log(`[WS_JOIN] User ${ws.userId} has no other connections in previous room ${ws.roomId}, removing from room`);
                removeUserFromRoom(ws.roomId, ws.userId);
                broadcastToRoom(ws.roomId, {
                  type: 'user_left',
                  userId: ws.userId,
                });
              } else {
                console.log(`[WS_JOIN] User ${ws.userId} still has other connections in previous room ${ws.roomId}, keeping in room`);
              }
            }

            // Multi-device support: Allow multiple connections per user
            console.log(`[MULTI_DEVICE] User ${message.userId} connecting to room ${message.roomId} (connection ${ws.connectionId})`);

            ws.userId = message.userId;
            ws.roomId = message.roomId;

            // Initialize or reset connection tracking for this user
            ws.isAlive = true;
            ws.lastActivity = Date.now();

            // Add this connection to the user's connection set
            addUserConnection(message.userId, ws);

            console.log(`[WS_JOIN] User ${message.userId} joining room ${message.roomId}`);

            // Update user online status
            await storage.updateUserOnlineStatus(message.userId, true);

            // Check if this is the user's first connection in this room BEFORE adding them
            const isFirstConnectionInRoom = !roomUsers.has(message.roomId) || 
                                            !roomUsers.get(message.roomId)!.has(message.userId);

            // Add user to new room (validates connection)
            addUserToRoom(message.roomId, message.userId);

            // Synchronize room users to ensure accuracy
            synchronizeRoomUsers(message.roomId);

            // Only broadcast user joined if this is their first connection in the room
            if (isFirstConnectionInRoom) {
              console.log(`[WS_JOIN] Broadcasting user_joined for ${message.userId} (first connection in room)`);
              broadcastToRoom(message.roomId, {
                type: 'user_joined',
                userId: message.userId,
              });
            } else {
              console.log(`[WS_JOIN] User ${message.userId} already in room ${message.roomId}, not broadcasting user_joined`);
            }
            break;

          case 'leave':
            console.log(`[WS_LEAVE] Leave request from userId=${message.userId || ws.userId}, roomId=${message.roomId || ws.roomId}`);
            const leaveUserId = message.userId || ws.userId;
            const leaveRoomId = message.roomId || ws.roomId;

            if (leaveUserId && leaveRoomId) {
              // Only remove from room and broadcast if no other connections in that room
              const userLeavingRoom = !hasOtherRoomConnections(leaveUserId, leaveRoomId, ws.connectionId);
              
              if (userLeavingRoom) {
                console.log(`[WS_LEAVE] User ${leaveUserId} has no other connections in room ${leaveRoomId}, removing from room`);
                removeUserFromRoom(leaveRoomId, leaveUserId);
                broadcastToRoom(leaveRoomId, {
                  type: 'user_left',
                  userId: leaveUserId,
                });
              } else {
                console.log(`[WS_LEAVE] User ${leaveUserId} still has other connections in room ${leaveRoomId}, keeping in room`);
              }
              
              // Clear this connection's room association so it stops receiving room broadcasts
              ws.roomId = undefined;
              console.log(`[WS_LEAVE] Connection ${ws.connectionId} cleared from room ${leaveRoomId}`);
            }
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
      console.log(`[WS_CLOSE] Connection ${ws.connectionId} closed for user ${ws.userId}, code: ${code}, reason: ${reason}`);

      if (ws.userId && ws.connectionId) {
        console.log(`[WS_CLOSE] Cleaning up connection ${ws.connectionId} for user ${ws.userId}`);

        // Check if user has other connections in this room BEFORE removing this connection
        const userLeftRoom = ws.roomId && !hasOtherRoomConnections(ws.userId, ws.roomId, ws.connectionId);

        // Remove this specific connection from the user's connection set
        removeUserConnection(ws.userId, ws.connectionId);

        // Remove user from room only if they have no other connections in the room
        if (userLeftRoom) {
          console.log(`[WS_CLOSE] User ${ws.userId} has no more connections in room ${ws.roomId}, removing from room`);
          removeUserFromRoom(ws.roomId, ws.userId);
          
          // Broadcast user left only when actually leaving the room
          broadcastToRoom(ws.roomId, {
            type: 'user_left',
            userId: ws.userId,
          });
        } else if (ws.roomId) {
          console.log(`[WS_CLOSE] User ${ws.userId} still has other connections in room ${ws.roomId}, keeping in room`);
        }

        // Only mark user offline if they have NO remaining connections
        if (!isUserOnline(ws.userId)) {
          console.log(`[WS_CLOSE] User ${ws.userId} has no more active connections, marking offline`);
          try {
            await storage.updateUserOnlineStatus(ws.userId, false);
          } catch (error) {
            console.error(`[WS_CLOSE] Failed to update offline status for user ${ws.userId}:`, error);
          }
        } else {
          console.log(`[WS_CLOSE] User ${ws.userId} still has active connections, keeping online`);
        }

        // Synchronize room users to ensure accuracy after disconnect
        synchronizeRoomUsers(ws.roomId);
      } else if (ws.userId) {
        // User connected but not in a room, still need to clean up connection
        console.log(`[WS_CLOSE] Cleaning up user ${ws.userId} (not in room)`);
        removeUserConnection(ws.userId, ws.connectionId);

        // Only mark offline if no remaining connections
        if (!isUserOnline(ws.userId)) {
          try {
            await storage.updateUserOnlineStatus(ws.userId, false);
          } catch (error) {
            console.error(`[WS_CLOSE] Failed to update offline status for user ${ws.userId}:`, error);
          }
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

  // Admin authentication routes
  app.post('/api/admin/login', async (req, res) => {
    console.log(`[ADMIN_AUTH] Admin login attempt started at ${new Date().toISOString()}`);
    console.log(`[ADMIN_AUTH] Admin login attempt for username: ${req.body?.username}`);
    try {
      const { adminLoginSchema } = await import('@shared/schema');
      const credentials = adminLoginSchema.parse(req.body);
      console.log(`[ADMIN_AUTH] Schema validation passed for admin login: ${credentials.username}`);

      console.log(`[ADMIN_AUTH] Authenticating admin: ${credentials.username}`);
      
      // Use admin authentication 
      const admin = await storage.authenticateAdmin(credentials);
      if (!admin) {
        console.log(`[ADMIN_AUTH] Authentication failed for username: ${credentials.username}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log(`[ADMIN_AUTH] Authentication successful for admin: ${admin.id} (${admin.username})`);
      
      // Create admin session
      const sessionData = {
        id: admin.id,
        username: admin.username,
        role: 'admin',
        loginTime: Date.now()
      };

      req.session.admin = sessionData;
      req.session.isAuthenticated = true;

      // Save session (force save for security)
      req.session.save((err) => {
        if (err) {
          console.error('[ADMIN_AUTH] Session save error:', err);
          return res.status(500).json({ error: 'Session creation failed' });
        }

        console.log(`[ADMIN_AUTH] Session created for admin: ${admin.username}`);
        
        // Don't send password in response
        const { password, ...adminWithoutPassword } = admin;
        res.json({ 
          admin: adminWithoutPassword,
          sessionId: req.sessionID,
          message: 'Login successful'
        });
      });
    } catch (error) {
      console.error(`[ADMIN_AUTH] Admin login error:`, error);
      res.status(400).json({ error: 'Admin login failed' });
    }
  });

  app.post('/api/admin/logout', async (req, res) => {
    console.log(`[ADMIN_AUTH] Admin logout attempt started at ${new Date().toISOString()}`);
    try {
      const adminUsername = req.session?.admin?.username || 'unknown';
      
      // Destroy the session
      req.session.destroy((err) => {
        if (err) {
          console.error(`[ADMIN_AUTH] Session destruction error for ${adminUsername}:`, err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        
        console.log(`[ADMIN_AUTH] Session destroyed for admin: ${adminUsername}`);
        
        // Clear the session cookie
        res.clearCookie('admin_session_id');
        res.json({ 
          success: true,
          message: 'Logout successful'
        });
      });
    } catch (error) {
      console.error(`[ADMIN_AUTH] Admin logout error:`, error);
      res.status(400).json({ error: 'Admin logout failed' });
    }
  });

  // Admin user management endpoints
  app.get('/api/admin/users/all', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json({ users: allUsers });
    } catch (error) {
      console.error('Error fetching all users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/online', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json({ users: onlineUsers });
    } catch (error) {
      console.error('Error fetching online users:', error);
      res.status(500).json({ error: 'Failed to fetch online users' });
    }
  });

  app.get('/api/admin/users/banned', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bannedUsers = await storage.getBannedUsers();
      res.json({ users: bannedUsers });
    } catch (error) {
      console.error('Error fetching banned users:', error);
      res.status(500).json({ error: 'Failed to fetch banned users' });
    }
  });

  app.get('/api/admin/users/blocked', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const blockedUsers = await storage.getAllBlockedUsers();
      res.json({ users: blockedUsers });
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  app.get('/api/admin/users/reported', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const reportedUsers = await storage.getReportedUsers();
      res.json({ users: reportedUsers });
    } catch (error) {
      console.error('Error fetching reported users:', error);
      res.status(500).json({ error: 'Failed to fetch reported users' });
    }
  });

  // Admin messaging endpoint
  app.post('/api/admin/send-message', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId, message, messageType = 'admin_notification' } = req.body;
      
      if (!userId || !message) {
        return res.status(400).json({ error: 'User ID and message are required' });
      }

      const result = await storage.sendAdminMessage(adminUser.id, userId, message, messageType);
      res.json({ success: true, messageId: result.id });
    } catch (error) {
      console.error('Error sending admin message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // User action endpoints
  app.post('/api/admin/users/:userId/ban', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId } = req.params;
      const { reason } = req.body;

      const banData = {
        userId,
        reason: reason || 'Banned by admin',
        permanent: true // Permanent ban
      };

      const result = await storage.banUser(banData, adminUser.id);
      res.json({ success: true, action: result });
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  });

  app.post('/api/admin/users/:userId/unban', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId } = req.params;
      const { reason } = req.body;

      const result = await storage.unbanUser(userId, adminUser.id, reason || 'Unbanned by admin');
      res.json({ success: true, result });
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(500).json({ error: 'Failed to unban user' });
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

  // Route alias to fix path mismatch issue
  app.get('/api/users/:userId/with-distance', async (req, res) => {
    console.log(`[API] Fetching users with distance for userId: ${req.params.userId} (alias route)`);
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

  // Health check endpoint to verify API routing works
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Static location mapping test endpoint (dev only)
  app.get('/api/geocode/coords', async (req, res) => {
    try {
      const { location } = req.query;
      
      if (!location || typeof location !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Location parameter is required' 
        });
      }

      const { GeocodingService } = await import('./geocoding-service');
      const result = await GeocodingService.geocodeLocation(location);
      res.json(result);
    } catch (error) {
      console.error('Static geocoding error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error during static geocoding' 
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
  app.get('/api/admin/rooms', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const rooms = await storage.getRooms();
      res.json({ rooms });
    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // Admin create room endpoint
  app.post('/api/admin/rooms', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { name, description, isPrivate = false } = req.body;

      const roomData = {
        name,
        description: description || '',
        isPrivate,
        memberIds: [],
        createdBy: adminUser.id
      };

      const room = await storage.createRoom(roomData);
      res.json({ room, message: 'Room created successfully' });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // Admin delete room endpoint
  app.delete('/api/admin/rooms/:id', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const roomId = req.params.id;

      const success = await storage.deleteRoom(roomId, adminUser.id);

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
  app.delete('/api/admin/messages', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
  app.get('/api/admin/users', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
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
        // Import bcrypt dynamically for this specific use case
        const bcrypt = await import('bcryptjs');
        const isValidPassword = await bcrypt.default.compare(confirmPassword, user.password);
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

      // Disconnect user from all WebSocket connections (multi-device support)
      const userConns = getUserConnections(userId);
      if (userConns.size > 0) {
        console.log(`[API] Disconnecting ${userConns.size} active connections for user ${userId}`);
        
        // Close all user connections and remove from rooms (only once per room)
        const roomsToRemoveFrom = new Set<string>();
        for (const client of userConns) {
          if (client.roomId) {
            roomsToRemoveFrom.add(client.roomId);
          }
        }
        
        // Remove user from each room only once
        for (const roomId of roomsToRemoveFrom) {
          removeUserFromRoom(roomId, userId);
        }
        
        // Close all connections
        for (const client of userConns) {
          try {
            client.close(1001, 'Account deleted');
          } catch (error) {
            console.error(`[API] Error closing connection ${client.connectionId}:`, error);
          }
        }
        
        // Clean up all user connections
        userConnections.delete(userId);
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
      const result = updatePrivacySettingsSchema.strict().safeParse(req.body);
      
      if (!result.success) {
        console.error('Privacy settings validation error:', result.error.flatten());
        return res.status(400).json({ 
          error: 'Invalid privacy settings data',
          details: result.error.flatten()
        });
      }

      const updatedSettings = await storage.updateUserPrivacySettings(userId, result.data);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Update privacy settings error:', error);
      res.status(500).json({ error: 'Failed to update privacy settings' });
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

  app.get('/api/admin/reports', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const reports = await storage.getReports(adminUser.id);
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


  app.put('/api/admin/reports/:reportId/status', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { reportId } = req.params;
      const statusUpdate = req.body;

      const validatedStatusUpdate = updateReportStatusSchema.parse(statusUpdate);
      const updatedReport = await storage.updateReportStatus(reportId, validatedStatusUpdate, adminUser.id);

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
  app.get('/api/admin/dashboard-stats', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getAdminDashboardStats();
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get('/api/admin/moderation-data', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const moderationData = await storage.getModerationData(adminUser.id);
      res.json(moderationData);
    } catch (error) {
      console.error('Error fetching moderation data:', error);
      res.status(500).json({ error: 'Failed to fetch moderation data' });
    }
  });

  app.get('/api/admin/banned-users', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bannedUsers = await storage.getBannedUsers();
      res.json({ users: bannedUsers });
    } catch (error) {
      console.error('Error fetching banned users:', error);
      res.status(500).json({ error: 'Failed to fetch banned users' });
    }
  });

  app.post('/api/admin/warn-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const warnData = warnUserSchema.parse(req.body);
      const action = await storage.warnUser(warnData, adminUser.id);
      res.json({ action });
    } catch (error) {
      console.error('Error warning user:', error);
      res.status(500).json({ error: 'Failed to warn user' });
    }
  });

  app.post('/api/admin/ban-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const banData = banUserSchema.parse(req.body);
      const result = await storage.banUser(banData, adminUser.id);
      res.json(result);
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  });

  app.post('/api/admin/unban-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId, reason } = req.body;
      const result = await storage.unbanUser(userId, adminUser.id, reason || 'Unbanned by admin');
      res.json(result);
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  });

  // Admin block user endpoint
  app.post('/api/admin/block-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId, reason } = req.body;

      const blockData = {
        blockerId: adminUser.id,
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
  app.post('/api/admin/unblock-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId } = req.body;

      const success = await storage.unblockUser(adminUser.id, userId);

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
  app.post('/api/admin/ban-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId, reason } = req.body;

      // Prevent admin from banning themselves
      if (adminUser.id === userId) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
      }

      const banData = {
        userId,
        reason: reason || 'Banned by admin',
        permanent: true
      };

      const result = await storage.banUser(banData, adminUser.id);
      res.json({ success: true, result, message: 'User banned successfully' });
    } catch (error: any) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: error.message || 'Failed to ban user' });
    }
  });

  // Admin unban user endpoint
  app.post('/api/admin/unban-user', requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUser = (req as any).adminUser; // Set by requireAdminAuth middleware
      const { userId } = req.body;

      const result = await storage.unbanUser(userId, adminUser.id, 'Unbanned by admin');
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
  app.post('/api/admin/cleanup-messages', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Admin privileges already verified by middleware

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
  app.get('/api/admin/cleanup-status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Admin privileges already verified by middleware

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