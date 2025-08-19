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
  type PrivateRoom,
  type PrivateChatData,
  type UserPhoto,
  type InsertUserPhoto,
  type UserWithPhotos,
  type BlockedUser,
  type InsertBlockedUser,
  type BlockedUserWithDetails,
  type UpdateUserProfile,
  type UserProfileSettings,
  users,
  rooms,
  messages,
  roomMembers,
  userPhotos,
  blockedUsers
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, desc, and } from "drizzle-orm";
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
        gender_preference TEXT NOT NULL DEFAULT 'all',
        age_min INTEGER DEFAULT 18,
        age_max INTEGER DEFAULT 99,
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

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        room_id TEXT NOT NULL REFERENCES rooms(id),
        timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        photo_url TEXT,
        photo_file_name TEXT,
        message_type TEXT NOT NULL DEFAULT 'text'
      );

      CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        blocker_id TEXT NOT NULL REFERENCES users(id),
        blocked_id TEXT NOT NULL REFERENCES users(id),
        blocked_at INTEGER DEFAULT (strftime('%s', 'now')),
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS user_photos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        photo_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        uploaded_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Add missing columns to users table if they don't exist
      PRAGMA table_info(users);
    `);
    
    // Check and add missing columns
    const userTableInfo = this.sqlite.pragma('table_info(users)');
    const existingColumns = userTableInfo.map((col: any) => col.name);
    
    if (!existingColumns.includes('gender_preference')) {
      this.sqlite.exec(`ALTER TABLE users ADD COLUMN gender_preference TEXT NOT NULL DEFAULT 'all';`);
    }
    if (!existingColumns.includes('age_min')) {
      this.sqlite.exec(`ALTER TABLE users ADD COLUMN age_min INTEGER DEFAULT 18;`);
    }
    if (!existingColumns.includes('age_max')) {
      this.sqlite.exec(`ALTER TABLE users ADD COLUMN age_max INTEGER DEFAULT 99;`);
    }
    
    this.sqlite.exec(`
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

  async deleteRoom(roomId: string, adminUserId: string): Promise<boolean> {
    // Verify the user is an admin
    const adminUser = await this.getUser(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    // Check if room exists
    const room = await this.getRoom(roomId);
    if (!room) {
      return false;
    }

    // Delete all messages in the room first
    this.db.delete(messages).where(eq(messages.roomId, roomId)).run();

    // Delete all room members
    this.db.delete(roomMembers).where(eq(roomMembers.roomId, roomId)).run();

    // Delete the room itself
    this.db.delete(rooms).where(eq(rooms.id, roomId)).run();

    return true;
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
      id,
      content: insertMessage.content,
      userId: insertMessage.userId,
      roomId: insertMessage.roomId,
      timestamp: new Date(),
      photoUrl: insertMessage.photoUrl || null,
      photoFileName: insertMessage.photoFileName || null,
      messageType: insertMessage.messageType || "text",
    };
    
    this.db.insert(messages).values(message).run();
    return message;
  }

  // Photo management methods
  async addUserPhoto(photoData: InsertUserPhoto): Promise<UserPhoto> {
    const id = randomUUID();
    const photo: UserPhoto = {
      id,
      userId: photoData.userId,
      photoUrl: photoData.photoUrl,
      fileName: photoData.fileName,
      isPrimary: photoData.isPrimary || false,
      uploadedAt: new Date(),
    };
    
    // If this is being set as primary, unset any existing primary photos
    if (photo.isPrimary) {
      this.db
        .update(userPhotos)
        .set({ isPrimary: false })
        .where(eq(userPhotos.userId, photo.userId))
        .run();
    }
    
    this.db.insert(userPhotos).values(photo).run();
    return photo;
  }

  async getUserPhotos(userId: string): Promise<UserPhoto[]> {
    return this.db
      .select()
      .from(userPhotos)
      .where(eq(userPhotos.userId, userId))
      .orderBy(sql`${userPhotos.isPrimary} DESC, ${userPhotos.uploadedAt} DESC`)
      .all();
  }

  async getUserWithPhotos(userId: string): Promise<UserWithPhotos | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const photos = await this.getUserPhotos(userId);
    const primaryPhoto = photos.find(p => p.isPrimary);
    
    return {
      ...user,
      photos,
      primaryPhoto,
    };
  }

  async deleteUserPhoto(photoId: string, userId: string): Promise<void> {
    this.db
      .delete(userPhotos)
      .where(
        sql`${userPhotos.id} = ${photoId} AND ${userPhotos.userId} = ${userId}`
      )
      .run();
  }

  async setPrimaryPhoto(photoId: string, userId: string): Promise<void> {
    // First, unset all primary photos for this user
    this.db
      .update(userPhotos)
      .set({ isPrimary: false })
      .where(eq(userPhotos.userId, userId))
      .run();
    
    // Then set the specified photo as primary
    this.db
      .update(userPhotos)
      .set({ isPrimary: true })
      .where(
        sql`${userPhotos.id} = ${photoId} AND ${userPhotos.userId} = ${userId}`
      )
      .run();
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

  async createPrivateRoom(user1Id: string, user2Id: string): Promise<Room> {
    // Create a unique room name for the private chat
    const sortedIds = [user1Id, user2Id].sort();
    const roomName = `private_${sortedIds[0]}_${sortedIds[1]}`;
    
    // Check if private room already exists
    const existingRoom = await this.getPrivateRoom(user1Id, user2Id);
    if (existingRoom) {
      return existingRoom;
    }
    
    const room: Room = {
      id: randomUUID(),
      name: roomName,
      description: "Private chat",
      isPrivate: true,
      createdBy: user1Id,
      createdAt: new Date(),
    };
    
    this.db.insert(rooms).values(room).run();
    
    // Add both users as members
    await this.addRoomMember({ roomId: room.id, userId: user1Id });
    await this.addRoomMember({ roomId: room.id, userId: user2Id });
    
    return room;
  }

  async getPrivateRoom(user1Id: string, user2Id: string): Promise<Room | undefined> {
    const sortedIds = [user1Id, user2Id].sort();
    const roomName = `private_${sortedIds[0]}_${sortedIds[1]}`;
    
    const result = this.db.select().from(rooms).where(eq(rooms.name, roomName)).get();
    return result || undefined;
  }

  async getPrivateRooms(userId: string): Promise<PrivateRoom[]> {
    // Get all private rooms where the user is a member
    const privateRoomData = this.db
      .select({
        room: rooms,
      })
      .from(rooms)
      .innerJoin(roomMembers, eq(rooms.id, roomMembers.roomId))
      .where(
        sql`${rooms.isPrivate} = 1 AND ${roomMembers.userId} = ${userId}`
      )
      .all();
    
    const privateRooms: PrivateRoom[] = [];
    
    for (const { room } of privateRoomData) {
      // Get the other participant
      const members = await this.getRoomMembers(room.id);
      const otherParticipant = members.find(member => member.id !== userId);
      
      if (otherParticipant) {
        const currentParticipant = members.find(member => member.id === userId)!;
        
        privateRooms.push({
          id: room.id,
          participant1Id: currentParticipant.id,
          participant2Id: otherParticipant.id,
          participant1: currentParticipant,
          participant2: otherParticipant,
        });
      }
    }
    
    return privateRooms;
  }

  async getRoomsAndPrivateRooms(userId: string): Promise<PrivateChatData> {
    // Get public rooms
    const publicRooms = this.db.select().from(rooms).where(eq(rooms.isPrivate, false)).all();
    
    // Get private rooms
    const privateRooms = await this.getPrivateRooms(userId);
    
    return {
      rooms: publicRooms,
      privateRooms,
    };
  }

  // Profile settings methods
  async updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User> {
    let latitude = profileData.latitude;
    let longitude = profileData.longitude;

    // Update coordinates if location changed
    if (profileData.location) {
      try {
        const coordinates = await GeocodingService.getCoordinates(profileData.location);
        latitude = coordinates.latitude.toString();
        longitude = coordinates.longitude.toString();
      } catch (error) {
        console.error('Failed to geocode location:', error);
        // Continue with the update even if geocoding fails
      }
    }

    const [updatedUser] = this.db
      .update(users)
      .set({
        displayName: profileData.displayName,
        location: profileData.location,
        latitude,
        longitude,
        genderPreference: profileData.genderPreference,
        ageMin: profileData.ageMin,
        ageMax: profileData.ageMax,
      })
      .where(eq(users.id, userId))
      .returning()
      .all();

    return updatedUser;
  }

  async getUserProfileSettings(userId: string): Promise<UserProfileSettings> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const photos = await this.getUserPhotos(userId);
    const primaryPhoto = photos.find(photo => photo.isPrimary);
    const blockedUsers = await this.getBlockedUsers(userId);

    return {
      user,
      photos,
      primaryPhoto,
      blockedUsers,
    };
  }

  // Blocked users methods
  async blockUser(blockData: InsertBlockedUser): Promise<BlockedUser> {
    const id = randomUUID();
    const [blockedUser] = this.db
      .insert(blockedUsers)
      .values({
        id,
        ...blockData,
      })
      .returning()
      .all();

    return blockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    this.db
      .delete(blockedUsers)
      .where(and(
        eq(blockedUsers.blockerId, blockerId),
        eq(blockedUsers.blockedId, blockedId)
      ))
      .run();
  }

  async getBlockedUsers(userId: string): Promise<BlockedUserWithDetails[]> {
    const blockedUsersWithDetails = this.db
      .select({
        id: blockedUsers.id,
        blockerId: blockedUsers.blockerId,
        blockedId: blockedUsers.blockedId,
        blockedAt: blockedUsers.blockedAt,
        reason: blockedUsers.reason,
        blockedUser: users,
      })
      .from(blockedUsers)
      .innerJoin(users, eq(blockedUsers.blockedId, users.id))
      .where(eq(blockedUsers.blockerId, userId))
      .all();

    return blockedUsersWithDetails;
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const result = this.db
      .select()
      .from(blockedUsers)
      .where(and(
        eq(blockedUsers.blockerId, blockerId),
        eq(blockedUsers.blockedId, blockedId)
      ))
      .limit(1)
      .all();

    return result.length > 0;
  }
}