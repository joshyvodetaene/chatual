import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertRoomSchema, insertMessageSchema } from "@shared/schema";

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
  
  console.log('WebSocket server initialized on path /ws');

  // Helper function to broadcast to room
  function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    Array.from(clients.values()).forEach(client => {
      if (client.roomId === roomId && client.readyState === WebSocket.OPEN && client.userId !== excludeUserId) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join':
            ws.userId = message.userId;
            ws.roomId = message.roomId;
            clients.set(message.userId, ws);
            
            // Update user online status
            await storage.updateUserOnlineStatus(message.userId, true);
            
            // Broadcast user joined
            broadcastToRoom(message.roomId, {
              type: 'user_joined',
              userId: message.userId,
            }, message.userId);
            break;

          case 'message':
            if (ws.userId && ws.roomId) {
              const newMessage = await storage.createMessage({
                content: message.content,
                userId: ws.userId,
                roomId: ws.roomId,
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
      if (ws.userId) {
        // Update user offline status
        await storage.updateUserOnlineStatus(ws.userId, false);
        
        // Broadcast user left
        if (ws.roomId) {
          broadcastToRoom(ws.roomId, {
            type: 'user_left',
            userId: ws.userId,
          });
        }
        
        clients.delete(ws.userId);
      }
    });
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, displayName } = req.body;
      
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({
          username,
          displayName,
        });
      }
      
      res.json({ user });
    } catch (error) {
      res.status(400).json({ error: 'Login failed' });
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
      
      const isAlreadyMember = await storage.isUserInRoom(roomId, userId);
      if (!isAlreadyMember) {
        await storage.addRoomMember({ roomId, userId });
      }
      
      res.json({ success: true });
    } catch (error) {
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
      const messages = await storage.getRoomMessages(req.params.id);
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  return httpServer;
}
