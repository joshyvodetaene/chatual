import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import BetterSQLite3 from "better-sqlite3";
import bcrypt from "bcryptjs";
import { GeocodingService } from "./geocoding-service";
import { 
  type User, 
  type Room, 
  type Message, 
  type RoomMember,
  type InsertUser, 
  type InsertRoom, 
  type InsertMessage, 
  type InsertRoomMember,
  type MessageWithUser,
  type RoomWithMembers,
  type RegisterUser,
  type LoginUser,
  type UserWithDistance,
  users,
  rooms,
  messages,
  roomMembers
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { IStorage } from "./storage";

export class SQLiteStorage implements IStorage {
  private db: BetterSQLite3Database;
  private sqlite: BetterSQLite3.Database;

  constructor(dbPath: string = "./chatual.db") {
    // Using better-sqlite3 for synchronous operations
    this.sqlite = new BetterSQLite3(dbPath);
    this.db = drizzle(this.sqlite);
    
    this.initializeDatabase();
    this.createDefaultData().catch(console.error);
  }

  private initializeDatabase() {
    // Create tables if they don't exist
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password TEXT NOT NULL,
        gender TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude TEXT,
        longitude TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        avatar TEXT,
        is_online INTEGER DEFAULT 0,
        last_seen INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_private INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        created_by TEXT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        room_id TEXT NOT NULL REFERENCES rooms(id),
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS room_members (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES rooms(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        joined_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
  }

  private async createDefaultData() {
    // Check if admin user exists
    const adminUser = await this.getUserByUsername('administrator');
    
    if (!adminUser) {
      // Create master admin user
      const hashedPassword = await bcrypt.hash('12345678', 10);
      const adminUserId = randomUUID();
      
      const masterAdmin = {
        id: adminUserId,
        username: 'administrator',
        displayName: 'Administrator',
        password: hashedPassword,
        gender: 'male',
        location: 'System',
        latitude: null,
        longitude: null,
        role: 'admin',
        avatar: null,
        isOnline: false,
        lastSeen: new Date(),
      };
      
      this.db.insert(users).values(masterAdmin).run();
      console.log('Master admin user created: administrator');
    }
    
    // Check if default rooms exist
    const existingRooms = this.db.select().from(rooms).all();
    
    if (existingRooms.length === 0) {
      const defaultRooms = [
        {
          id: randomUUID(),
          name: "flirt",
          description: "Flirtatious conversations and connections",
          isPrivate: false,
          createdBy: adminUser?.id || null,
        },
        {
          id: randomUUID(),
          name: "Sub & dom",
          description: "Discussions about power dynamics",
          isPrivate: false,
          createdBy: adminUser?.id || null,
        },
        {
          id: randomUUID(),
          name: "whispering",
          description: "Intimate and quiet conversations",
          isPrivate: false,
          createdBy: adminUser?.id || null,
        },
        {
          id: randomUUID(),
          name: "shades of senses",
          description: "Sensory experiences and discussions",
          isPrivate: false,
          createdBy: adminUser?.id || null,
        },
      ];
      
      for (const room of defaultRooms) {
        this.db.insert(rooms).values(room).run();
      }
      
      console.log('Default chatrooms created: flirt, Sub & dom, whispering, shades of senses');
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = this.db.select().from(users).where(eq(users.id, id)).get();
    return result || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = this.db.select().from(users).where(eq(users.username, username)).get();
    return result || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || 'user',
      latitude: insertUser.latitude || null,
      longitude: insertUser.longitude || null,
      avatar: insertUser.avatar || null,
      isOnline: false,
      lastSeen: new Date(),
    };
    
    this.db.insert(users).values(user).run();
    return user;
  }

  async registerUser(registerData: RegisterUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(registerData.password, 10);
    
    // Geocode the location
    const geoResult = await GeocodingService.geocodeLocation(registerData.location);
    
    const user: User = {
      id,
      username: registerData.username,
      displayName: registerData.displayName,
      password: hashedPassword,
      gender: registerData.gender,
      location: registerData.location,
      latitude: geoResult.success ? geoResult.latitude.toString() : null,
      longitude: geoResult.success ? geoResult.longitude.toString() : null,
      role: 'user', // All new registrations are regular users
      avatar: registerData.avatar || null,
      isOnline: false,
      lastSeen: new Date(),
    };
    
    this.db.insert(users).values(user).run();
    return user;
  }

  async authenticateUser(credentials: LoginUser): Promise<User | null> {
    const user = await this.getUserByUsername(credentials.username);
    if (!user) return null;
    
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) return null;
    
    return user;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    return !user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    this.db
      .update(users)
      .set({ isOnline, lastSeen: new Date() })
      .where(eq(users.id, userId))
      .run();
  }

  async getOnlineUsers(): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.isOnline, true)).all();
  }

  async getUsersWithDistance(currentUserId: string): Promise<UserWithDistance[]> {
    const currentUser = await this.getUser(currentUserId);
    if (!currentUser || !currentUser.latitude || !currentUser.longitude) {
      return [];
    }

    const allUsers = this.db.select().from(users).where(eq(users.isOnline, true)).all();
    
    return allUsers
      .filter(user => user.id !== currentUserId && user.latitude && user.longitude)
      .map(user => {
        const distance = GeocodingService.calculateDistance(
          parseFloat(currentUser.latitude!),
          parseFloat(currentUser.longitude!),
          parseFloat(user.latitude!),
          parseFloat(user.longitude!)
        );
        
        return {
          ...user,
          distance
        };
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = randomUUID();
    const room: Room = { 
      ...insertRoom, 
      id,
      description: insertRoom.description || null,
      isPrivate: insertRoom.isPrivate || false,
      createdBy: insertRoom.createdBy || null,
      createdAt: new Date(),
    };
    
    this.db.insert(rooms).values(room).run();
    return room;
  }

  async getRooms(): Promise<Room[]> {
    return this.db.select().from(rooms).all();
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const result = this.db.select().from(rooms).where(eq(rooms.id, id)).get();
    return result || undefined;
  }

  async getRoomWithMembers(id: string): Promise<RoomWithMembers | undefined> {
    const room = await this.getRoom(id);
    if (!room) return undefined;

    const members = await this.getRoomMembers(id);
    return {
      ...room,
      memberCount: members.length,
      members,
    };
  }

  async addRoomMember(insertRoomMember: InsertRoomMember): Promise<RoomMember> {
    const id = randomUUID();
    const roomMember: RoomMember = { 
      ...insertRoomMember, 
      id,
      joinedAt: new Date(),
    };
    
    this.db.insert(roomMembers).values(roomMember).run();
    return roomMember;
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    this.db
      .delete(roomMembers)
      .where(
        sql`${roomMembers.roomId} = ${roomId} AND ${roomMembers.userId} = ${userId}`
      )
      .run();
  }

  async getRoomMembers(roomId: string): Promise<User[]> {
    const memberData = this.db
      .select({
        user: users
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, roomId))
      .all();
    
    return memberData.map(item => item.user);
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    const roomData = this.db
      .select({
        room: rooms
      })
      .from(roomMembers)
      .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
      .where(eq(roomMembers.userId, userId))
      .all();
    
    return roomData.map(item => item.room);
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const result = this.db
      .select()
      .from(roomMembers)
      .where(
        sql`${roomMembers.roomId} = ${roomId} AND ${roomMembers.userId} = ${userId}`
      )
      .get();
    
    return !!result;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = { 
      ...insertMessage, 
      id,
      timestamp: new Date(),
    };
    
    this.db.insert(messages).values(message).run();
    return message;
  }

  async getRoomMessages(roomId: string, limit: number = 50): Promise<MessageWithUser[]> {
    const messageData = this.db
      .select({
        message: messages,
        user: users
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.timestamp))
      .limit(limit)
      .all();
    
    return messageData.map(item => ({
      ...item.message,
      user: item.user
    })).reverse();
  }
}