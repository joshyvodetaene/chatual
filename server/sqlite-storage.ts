import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import BetterSQLite3 from "better-sqlite3";
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
    this.createDefaultData();
  }

  private initializeDatabase() {
    // Create tables if they don't exist
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
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

  private createDefaultData() {
    // Check if default room exists
    const existingRooms = this.db.select().from(rooms).all();
    
    if (existingRooms.length === 0) {
      const defaultRoom = {
        id: randomUUID(),
        name: "general",
        description: "General discussion room",
        isPrivate: false,
        createdBy: null,
      };
      
      this.db.insert(rooms).values(defaultRoom).run();
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
      avatar: insertUser.avatar || null,
      isOnline: false,
      lastSeen: new Date(),
    };
    
    this.db.insert(users).values(user).run();
    return user;
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