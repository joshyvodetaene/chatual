import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertRoomSchema, insertMessageSchema, registerUserSchema, loginSchema, insertUserPhotoSchema, updateUserProfileSchema, insertBlockedUserSchema, insertReportSchema, reportSchema, updateReportStatusSchema, warnUserSchema, banUserSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

interface WebSocketClient extends WebSocket {
  userId?: string;
  roomId?: string;
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
  
  console.log('WebSocket server initialized on path /ws');

  // Helper function to broadcast to room
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    Array.from(clients.values()).forEach(client => {
      if (client.roomId === roomId && client.readyState === WebSocket.OPEN && client.userId !== excludeUserId) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Helper functions for room user management
  function addUserToRoom(roomId: string, userId: string) {
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Set());
    }
    roomUsers.get(roomId)!.add(userId);
    
    // Broadcast updated online users for this room
    broadcastToRoom(roomId, {
      type: 'room_online_users',
      roomId,
      onlineUsers: Array.from(roomUsers.get(roomId) || [])
    });
  }

  function removeUserFromRoom(roomId: string, userId: string) {
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId)!.delete(userId);
      
      // Broadcast updated online users for this room
      broadcastToRoom(roomId, {
        type: 'room_online_users',
        roomId,
        onlineUsers: Array.from(roomUsers.get(roomId) || [])
      });
    }
  }

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join':
            // Remove user from previous room if any
            if (ws.roomId && ws.userId) {
              removeUserFromRoom(ws.roomId, ws.userId);
            }
            
            ws.userId = message.userId;
            ws.roomId = message.roomId;
            clients.set(message.userId, ws);
            
            // Update user online status
            await storage.updateUserOnlineStatus(message.userId, true);
            
            // Add user to new room
            addUserToRoom(message.roomId, message.userId);
            
            // Broadcast user joined
            broadcastToRoom(message.roomId, {
              type: 'user_joined',
              userId: message.userId,
            }, message.userId);
            break;

          case 'message':
            if (ws.userId && ws.roomId) {
              // Normalize photo URL if this is a photo message
              let normalizedPhotoUrl = message.photoUrl;
              if (message.photoUrl && message.messageType === 'photo') {
                const objectStorageService = new ObjectStorageService();
                normalizedPhotoUrl = objectStorageService.normalizePhotoPath(message.photoUrl);
              }
              
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                roomId: ws.roomId,
                photoUrl: normalizedPhotoUrl,
                photoFileName: message.photoFileName,
                messageType: message.messageType || 'text',
              });
              
              const user = await storage.getUser(ws.userId);
              const messageWithUser = { ...newMessage, user };
              
              // Broadcast message to room
              broadcastToRoom(ws.roomId, {
                type: 'new_message',
                message: messageWithUser,
              });
            }
            break;

          case 'typing':
            if (ws.userId && ws.roomId) {
              broadcastToRoom(ws.roomId, {
                type: 'user_typing',
                userId: ws.userId,
                isTyping: message.isTyping,
              }, ws.userId);
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      if (ws.userId && ws.roomId) {
        // Remove user from room and update online status
        removeUserFromRoom(ws.roomId, ws.userId);
        await storage.updateUserOnlineStatus(ws.userId, false);
        
        // Broadcast user left
        broadcastToRoom(ws.roomId, {
          type: 'user_left',
          userId: ws.userId,
        });
        
        clients.delete(ws.userId);
      }
    });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = registerUserSchema.parse(req.body);
      
      // Check if username is available
      const isAvailable = await storage.isUsernameAvailable(userData.username);
      if (!isAvailable) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      
      const user = await storage.registerUser(userData);
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(400).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      
      const user = await storage.authenticateUser(credentials);
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(400).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { userId } = req.body;
      if (userId) {
        await storage.updateUserOnlineStatus(userId, false);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Logout failed' });
    }
  });

  app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const isAvailable = await storage.isUsernameAvailable(username);
      res.json({ available: isAvailable });
    } catch (error) {
      res.status(400).json({ error: 'Username check failed' });
    }
  });

  // User routes
  app.get('/api/users/online', async (req, res) => {
    try {
      const users = await storage.getOnlineUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch online users' });
    }
  });

  app.get('/api/users/with-distance/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const users = await storage.getUsersWithDistance(userId);
      res.json({ users });
    } catch (error) {
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
      
      const room = await storage.createPrivateRoom(user1Id, user2Id);
      res.json({ room });
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

  // Serve photos
  app.get('/photos/:photoPath(*)', async (req, res) => {
    const photoPath = '/' + req.params.photoPath;
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
        limit: limit ? parseInt(limit as string) : undefined,
        before: before as string,
        after: after as string,
      };
      
      const result = await storage.getRoomMessages(req.params.id, pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
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

  app.get('/api/admin/moderation-data', async (req, res) => {
    try {
      const { adminUserId } = req.query;
      
      if (!adminUserId) {
        return res.status(401).json({ error: 'Admin authentication required' });
      }
      
      const moderationData = await storage.getModerationData(adminUserId as string);
      res.json(moderationData);
    } catch (error) {
      console.error('Get moderation data error:', error);
      if (error instanceof Error && error.message?.includes('Access denied')) {
        res.status(403).json({ error: 'Admin privileges required' });
      } else {
        res.status(500).json({ error: 'Failed to fetch moderation data' });
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
      // In a real app, you'd get the admin user from session/auth
      // For now, using hardcoded admin ID
      const adminUserId = req.headers.adminuserid as string || '7a6dab62-7327-4f79-b025-952b687688c1';
      const stats = await storage.getAdminDashboardStats();
      res.json({ stats });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get('/api/admin/moderation-data', async (req, res) => {
    try {
      const adminUserId = req.headers.adminuserid as string || '7a6dab62-7327-4f79-b025-952b687688c1';
      const moderationData = await storage.getModerationData(adminUserId);
      res.json(moderationData);
    } catch (error) {
      console.error('Error fetching moderation data:', error);
      res.status(500).json({ error: 'Failed to fetch moderation data' });
    }
  });

  app.get('/api/admin/banned-users', async (req, res) => {
    try {
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
