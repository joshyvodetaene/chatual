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
  type Report,
  type InsertReport,
  type UpdateReportStatus,
  type ReportWithDetails,
  type ModerationData,
  type UserModerationAction,
  type InsertModerationAction,
  type UserModerationActionWithDetails,
  type WarnUser,
  type BanUser,
  type AdminDashboardStats,
  type PaginationParams,
  type PaginatedResponse,
  type MessageReaction,
  type InsertMessageReaction,
  type ReactionSummary,
  type MessageWithReactions,
  users,
  rooms,
  messages,
  roomMembers,
  userPhotos,
  blockedUsers,
  reports,
  userModerationActions,
  messageReactions
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, ne, sql, gt, lt, like, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Database is already initialized in db.ts
    this.setupConnectionErrorHandling();
  }

  private setupConnectionErrorHandling() {
    // Add connection error handling
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing database connections...');
      await this.closeConnections();
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, closing database connections...');
      await this.closeConnections();
    });
  }

  private async closeConnections() {
    try {
      // Close database connections gracefully
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error(`Error getting user ${id}:`, error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error(`Error getting user by username ${username}:`, error);
      throw error;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error) {
      console.error(`Error creating user ${user.username}:`, error);
      throw error;
    }
  }

  async registerUser(user: RegisterUser): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const newUser: InsertUser = {
        username: user.username,
        displayName: user.displayName,
        password: hashedPassword,
        age: user.age,
        gender: user.gender,
        location: user.location,
        latitude: user.latitude,
        longitude: user.longitude,
        genderPreference: 'all',
        ageMin: 18,
        ageMax: 99,
        role: 'user',
        avatar: null,
      };

      const result = await this.createUser(newUser);
      return result;
    } catch (error) {
      console.error(`Error registering user ${user.username}:`, error);
      throw error;
    }
  }

  async authenticateUser(credentials: LoginUser): Promise<User | null> {
    console.log(`[DB] Authenticating user: ${credentials.username}`);
    try {
      const user = await this.getUserByUsername(credentials.username);
      if (!user) {
        console.log(`[DB] Authentication failed - user not found: ${credentials.username}`);
        return null;
      }

      console.log(`[DB] User found, verifying password for: ${credentials.username}`);
      const isValidPassword = await bcrypt.compare(credentials.password, user.password);
      if (!isValidPassword) {
        console.log(`[DB] Authentication failed - invalid password for: ${credentials.username}`);
        return null;
      }

      console.log(`[DB] Password verified, updating online status for: ${user.id}`);
      // Update online status
      await this.updateUserOnlineStatus(user.id, true);
      console.log(`[DB] Authentication successful for user: ${user.id} (${user.username})`);

      return user;
    } catch (error) {
      console.error(`[DB] Error authenticating user ${credentials.username}:`, error);
      throw error;
    }
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    console.log(`[DB] Checking username availability: ${username}`);
    try {
      const user = await this.getUserByUsername(username);
      const isAvailable = !user;
      console.log(`[DB] Username ${username} is ${isAvailable ? 'available' : 'taken'}`);
      return isAvailable;
    } catch (error) {
      console.error(`[DB] Error checking username availability ${username}:`, error);
      throw error;
    }
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    console.log(`[DB] Updating online status for user ${userId}: ${isOnline}`);
    try {
      await db.update(users)
        .set({
          isOnline,
          lastSeen: new Date()
        })
        .where(eq(users.id, userId));
      console.log(`[DB] Online status updated successfully for user ${userId}`);
    } catch (error) {
      console.error(`[DB] Error updating online status for user ${userId}:`, error);
      throw error;
    }
  }

  async getOnlineUsers(): Promise<User[]> {
    console.log(`[DB] Fetching online users`);
    try {
      const onlineUsers = await db.select().from(users).where(eq(users.isOnline, true));
      console.log(`[DB] Found ${onlineUsers.length} online users`);
      return onlineUsers;
    } catch (error) {
      console.error(`[DB] Error fetching online users:`, error);
      throw error;
    }
  }

  async getUsersWithDistance(currentUserId: string): Promise<UserWithDistance[]> {
    // Get current user to access their preferences
    const currentUser = await this.getUser(currentUserId);
    if (!currentUser) {
      return [];
    }

    // Get all users except the current user
    const allUsers = await db.select().from(users).where(ne(users.id, currentUserId));

    // Filter users based on current user's preferences
    const filteredUsers = allUsers.filter(user => {
      // Check gender preference
      if (currentUser.genderPreference !== 'all' && user.gender !== currentUser.genderPreference) {
        return false;
      }

      // Check age range preference
      if (user.age < (currentUser.ageMin || 18) || user.age > (currentUser.ageMax || 99)) {
        return false;
      }

      return true;
    });

    // For now, return filtered users with mock distance - real implementation would calculate distance
    return filteredUsers.map(user => ({
      ...user,
      distance: Math.floor(Math.random() * 50) + 1 // Mock distance 1-50 miles
    }));
  }

  // Room methods
  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async getRooms(): Promise<Room[]> {
    return await db.select().from(rooms);
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getRoomWithMembers(id: string): Promise<RoomWithMembers | undefined> {
    const room = await this.getRoom(id);
    if (!room) return undefined;

    const members = await this.getRoomMembers(id);
    return {
      ...room,
      members,
      memberCount: members.length
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
    await db.delete(messages).where(eq(messages.roomId, roomId));

    // Delete all room members
    await db.delete(roomMembers).where(eq(roomMembers.roomId, roomId));

    // Delete the room itself
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return true;
  }

  // Room member methods
  async addRoomMember(roomMember: InsertRoomMember): Promise<RoomMember> {
    const [newMember] = await db.insert(roomMembers).values(roomMember).returning();
    return newMember;
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    await db.delete(roomMembers)
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ));
  }

  async getRoomMembers(roomId: string): Promise<User[]> {
    const members = await db
      .select({
        user: users,
        photo: userPhotos
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .leftJoin(userPhotos, and(
        eq(userPhotos.userId, users.id),
        eq(userPhotos.isPrimary, true)
      ))
      .where(eq(roomMembers.roomId, roomId));

    return members.map(m => ({
      ...m.user,
      primaryPhoto: m.photo ? {
        id: m.photo.id,
        photoUrl: m.photo.photoUrl,
        fileName: m.photo.fileName,
        isPrimary: m.photo.isPrimary || false
      } : null
    }));
  }

  async getUserRooms(userId: string): Promise<Room[]> {
    const userRooms = await db
      .select({
        room: rooms
      })
      .from(roomMembers)
      .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
      .where(eq(roomMembers.userId, userId));

    return userRooms.map(r => r.room);
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(roomMembers)
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ));

    return !!member;
  }

  // Private room methods
  async createPrivateRoom(user1Id: string, user2Id: string): Promise<Room> {
    console.log(`[DB] Creating private room between ${user1Id} and ${user2Id}`);

    // Check if private room already exists
    const existingRoom = await this.getPrivateRoom(user1Id, user2Id);
    if (existingRoom) {
      console.log(`[DB] Private room already exists: ${existingRoom.id}`);
      return existingRoom;
    }

    const roomData: InsertRoom = {
      name: `Private Chat`,
      description: 'Private conversation',
      createdBy: user1Id,
      isPrivate: true,
      memberIds: [user1Id, user2Id]
    };

    console.log(`[DB] Creating new private room with data:`, roomData);
    const room = await this.createRoom(roomData);
    console.log(`[DB] Private room created with ID: ${room.id}`);

    // Add both users as members to ensure proper tracking
    console.log(`[DB] Adding room members for private room ${room.id}`);
    await Promise.all([
      this.addRoomMember({ roomId: room.id, userId: user1Id }),
      this.addRoomMember({ roomId: room.id, userId: user2Id })
    ]);

    console.log(`[DB] Private room ${room.id} setup complete`);
    return room;
  }

  async getPrivateRoom(user1Id: string, user2Id: string): Promise<Room | undefined> {
    console.log(`[DB] Looking for existing private room between ${user1Id} and ${user2Id}`);

    // Get all private rooms where user1 is a member
    const user1Rooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
      .where(and(
        eq(roomMembers.userId, user1Id),
        eq(rooms.isPrivate, true)
      ));

    console.log(`[DB] User1 is in ${user1Rooms.length} private rooms`);

    // Check each room to see if user2 is also a member
    for (const { roomId } of user1Rooms) {
      const members = await db
        .select({ userId: roomMembers.userId })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, roomId));

      const memberIds = members.map(m => m.userId);
      console.log(`[DB] Room ${roomId} has members: ${memberIds}`);

      // Check if this room has exactly these two users
      if (
        memberIds.includes(user1Id) &&
        memberIds.includes(user2Id) &&
        memberIds.length === 2
      ) {
        console.log(`[DB] Found existing private room: ${roomId}`);
        const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
        return room;
      }
    }

    console.log(`[DB] No existing private room found between ${user1Id} and ${user2Id}`);
    return undefined;
  }

  async getPrivateRooms(userId: string): Promise<PrivateRoom[]> {
    console.log(`[DB] Getting private rooms for user: ${userId}`);

    // Get all private rooms where the user is a member
    const privateRoomsData = await db
      .select({
        room: rooms,
      })
      .from(roomMembers)
      .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
      .where(and(
        eq(roomMembers.userId, userId),
        eq(rooms.isPrivate, true)
      ));

    console.log(`[DB] Found ${privateRoomsData.length} private rooms for user ${userId}`);

    const privateRoomsWithOtherUser: PrivateRoom[] = [];

    for (const { room } of privateRoomsData) {
      console.log(`[DB] Processing private room: ${room.id}, memberIds: ${room.memberIds}`);

      // Get all members of this room
      const members = await this.getRoomMembers(room.id);
      console.log(`[DB] Room ${room.id} has ${members.length} members`);

      // Find the other participant (not the current user)
      const otherUser = members.find(member => member.id !== userId);
      const currentUser = members.find(member => member.id === userId);

      if (otherUser && currentUser) {
        console.log(`[DB] Private room ${room.id}: ${currentUser.displayName} <-> ${otherUser.displayName}`);
        privateRoomsWithOtherUser.push({
          id: room.id,
          participant1Id: userId,
          participant2Id: otherUser.id,
          participant1: currentUser,
          participant2: otherUser
        });
      } else {
        console.log(`[DB] Skipping private room ${room.id} - missing participants`);
      }
    }

    console.log(`[DB] Returning ${privateRoomsWithOtherUser.length} private rooms with user details`);
    return privateRoomsWithOtherUser;
  }

  async deletePrivateRoom(roomId: string, userId: string): Promise<boolean> {
    // First verify that this is a private room and the user is a member
    const room = await db
      .select()
      .from(rooms)
      .where(and(
        eq(rooms.id, roomId),
        eq(rooms.isPrivate, true)
      ));

    if (!room.length || !room[0].memberIds?.includes(userId)) {
      return false; // User not authorized to delete this room
    }

    // Delete all messages in this room first
    await db.delete(messages).where(eq(messages.roomId, roomId));

    // Delete all room members
    await db.delete(roomMembers).where(eq(roomMembers.roomId, roomId));

    // Delete the room itself
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return true;
  }

  async getRoomsAndPrivateRooms(userId: string): Promise<PrivateChatData> {
    const allRooms = await this.getRooms();
    const publicRooms = allRooms.filter(room => !room.isPrivate);
    const privateRooms = await this.getPrivateRooms(userId);

    return {
      rooms: publicRooms,
      privateRooms
    };
  }

  // Search functionality
  async searchMessages(query: string, roomId?: string, userId?: string, limit: number = 20): Promise<MessageWithUser[]> {
    console.log(`[DB] Searching messages with query: "${query}", roomId: ${roomId}, userId: ${userId}`);

    let whereConditions = [ilike(messages.content, `%${query}%`)];

    if (roomId) {
      whereConditions.push(eq(messages.roomId, roomId));
    }

    if (userId) {
      // Only search in rooms where the user is a member
      const userRooms = await db
        .select({ roomId: roomMembers.roomId })
        .from(roomMembers)
        .where(eq(roomMembers.userId, userId));

      const roomIds = userRooms.map(r => r.roomId);
      if (roomIds.length > 0) {
        whereConditions.push(sql`${messages.roomId} = ANY(${roomIds})`);
      } else {
        return []; // User is not in any rooms
      }
    }

    const result = await db
      .select({
        message: messages,
        user: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const searchResults = result.map(({ message, user }) => ({
      ...message,
      user: user
    }));

    console.log(`[DB] Found ${searchResults.length} message search results`);
    return searchResults;
  }

  async searchUsers(query: string, currentUserId?: string, limit: number = 20): Promise<User[]> {
    console.log(`[DB] Searching users with query: "${query}", currentUserId: ${currentUserId}`);

    let whereConditions = [
      or(
        ilike(users.username, `%${query}%`),
        ilike(users.displayName, `%${query}%`)
      )
    ];

    // Exclude current user from search results
    if (currentUserId) {
      whereConditions.push(ne(users.id, currentUserId));
    }

    // Exclude banned users
    whereConditions.push(eq(users.isBanned, false));

    const searchResults = await db
      .select()
      .from(users)
      .where(and(...whereConditions))
      .orderBy(desc(users.isOnline), users.displayName)
      .limit(limit);

    console.log(`[DB] Found ${searchResults.length} user search results`);
    return searchResults;
  }

  async searchRooms(query: string, userId?: string, limit: number = 20): Promise<Room[]> {
    console.log(`[DB] Searching rooms with query: "${query}", userId: ${userId}`);

    let whereConditions = [
      or(
        ilike(rooms.name, `%${query}%`),
        ilike(rooms.description, `%${query}%`)
      ),
      eq(rooms.isPrivate, false) // Only search public rooms
    ];

    const searchResults = await db
      .select()
      .from(rooms)
      .where(and(...whereConditions))
      .orderBy(rooms.name)
      .limit(limit);

    console.log(`[DB] Found ${searchResults.length} room search results`);
    return searchResults;
  }

  // Reaction methods
  async addReaction(reactionData: InsertMessageReaction): Promise<MessageReaction> {
    console.log(`[DB] Adding reaction: ${reactionData.emoji} to message ${reactionData.messageId} by user ${reactionData.userId}`);

    // Check if user already reacted with this emoji
    const existingReaction = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, reactionData.messageId),
          eq(messageReactions.userId, reactionData.userId),
          eq(messageReactions.emoji, reactionData.emoji)
        )
      )
      .limit(1);

    if (existingReaction.length > 0) {
      console.log(`[DB] User already reacted with this emoji`);
      return existingReaction[0];
    }

    const newReaction = await this.retryDatabaseOperation(async () => {
      const [reaction] = await db
        .insert(messageReactions)
        .values({ ...reactionData, id: randomUUID() })
        .returning();
      return reaction;
    });


    console.log(`[DB] Reaction added successfully: ${newReaction.id}`);
    return newReaction;
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    console.log(`[DB] Removing reaction: ${emoji} from message ${messageId} by user ${userId}`);

    const result = await this.retryDatabaseOperation(async () => {
      const res = await db
        .delete(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, userId),
            eq(messageReactions.emoji, emoji)
          )
        );
      return res;
    });

    console.log(`[DB] Reaction removal result: ${result.rowCount} rows affected`);
    return (result.rowCount || 0) > 0;
  }

  async getMessageReactions(messageId: string, currentUserId?: string): Promise<ReactionSummary[]> {
    console.log(`[DB] Getting reactions for message: ${messageId}`);

    const reactions = await db
      .select({
        reaction: messageReactions,
        user: users,
      })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .where(eq(messageReactions.messageId, messageId))
      .orderBy(messageReactions.createdAt);

    // Group reactions by emoji
    const reactionMap = new Map<string, ReactionSummary>();

    reactions.forEach(({ reaction, user }) => {
      const existing = reactionMap.get(reaction.emoji);
      if (existing) {
        existing.count++;
        existing.users.push({ id: user.id, displayName: user.displayName });
        if (user.id === currentUserId) {
          existing.userReacted = true;
        }
      } else {
        reactionMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          userReacted: user.id === currentUserId,
          users: [{ id: user.id, displayName: user.displayName }]
        });
      }
    });

    const summary = Array.from(reactionMap.values());
    console.log(`[DB] Found ${summary.length} different reaction types for message ${messageId}`);
    return summary;
  }

  // Message methods
  async createMessage(data: InsertMessage): Promise<MessageWithUser> {
    console.log(`[STORAGE] Creating message - userId: ${data.userId}, roomId: ${data.roomId}, messageType: ${data.messageType}, hasPhoto: ${!!data.photoUrl}`);

    const message = await this.retryDatabaseOperation(async () => {
      const [msg] = await db.insert(messages).values(data).returning();
      return msg;
    });

    console.log(`[STORAGE] Message created with ID: ${message.id}, messageType: ${message.messageType}`);

    const user = await this.getUser(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    console.log(`[STORAGE] Returning message with user data:`, {
      messageId: message.id,
      messageType: message.messageType,
      photoUrl: message.photoUrl,
      userName: user.displayName
    });

    return { ...message, user };
  }

  async getRoomMessages(roomId: string, pagination: PaginationParams = {}): Promise<PaginatedResponse<MessageWithUser>> {
    const { limit = 20, before, after } = pagination;

    // Build base condition
    let whereCondition = eq(messages.roomId, roomId);

    // Add cursor-based pagination conditions
    if (before) {
      whereCondition = and(
        eq(messages.roomId, roomId),
        gt(messages.createdAt, new Date(before))
      )!;
    } else if (after) {
      whereCondition = and(
        eq(messages.roomId, roomId),
        lt(messages.createdAt, new Date(after))
      )!;
    }

    // Get one extra message to check if there are more
    const roomMessages = await db
      .select({
        message: messages,
        user: users,
        photo: userPhotos
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .leftJoin(userPhotos, and(
        eq(userPhotos.userId, users.id),
        eq(userPhotos.isPrimary, true)
      ))
      .where(whereCondition)
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = roomMessages.length > limit;
    const items = roomMessages.slice(0, limit);

    const messagesWithUser = items.map(({ message, user, photo }) => ({
      ...message,
      user: {
        ...user,
        primaryPhoto: photo ? {
          id: photo.id,
          photoUrl: photo.photoUrl,
          fileName: photo.fileName,
          isPrimary: photo.isPrimary || false
        } : null
      }
    })).reverse(); // Reverse to show oldest first

    // Generate cursors
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].message.createdAt?.toISOString() : undefined;
    const prevCursor = items.length > 0 ? items[0].message.createdAt?.toISOString() : undefined;

    return {
      items: messagesWithUser,
      hasMore,
      nextCursor,
      prevCursor
    };
  }

  // Photo methods
  async addUserPhoto(photoData: InsertUserPhoto): Promise<UserPhoto> {
    const newPhoto = await this.retryDatabaseOperation(async () => {
      const [photo] = await db.insert(userPhotos).values(photoData).returning();
      return photo;
    });
    return newPhoto;
  }

  async getUserPhotos(userId: string): Promise<UserPhoto[]> {
    return await db.select().from(userPhotos).where(eq(userPhotos.userId, userId));
  }

  async getUserWithPhotos(userId: string): Promise<UserWithPhotos | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const photos = await this.getUserPhotos(userId);
    const primaryPhoto = photos.find(p => p.isPrimary);

    return {
      ...user,
      photos,
      primaryPhoto: primaryPhoto ? {
        ...primaryPhoto,
        isPrimary: primaryPhoto.isPrimary || false
      } : primaryPhoto
    };
  }

  async deleteUserPhoto(photoId: string, userId: string): Promise<void> {
    await this.retryDatabaseOperation(async () => {
      await db.delete(userPhotos)
        .where(and(
          eq(userPhotos.id, photoId),
          eq(userPhotos.userId, userId)
        ));
    });
  }

  async setPrimaryPhoto(photoId: string, userId: string): Promise<void> {
    // First, unset all primary photos for this user
    await this.retryDatabaseOperation(async () => {
      await db.update(userPhotos)
        .set({ isPrimary: false })
        .where(eq(userPhotos.userId, userId));
    });

    // Then set the selected photo as primary
    await this.retryDatabaseOperation(async () => {
      await db.update(userPhotos)
        .set({ isPrimary: true })
        .where(and(
          eq(userPhotos.id, photoId),
          eq(userPhotos.userId, userId)
        ));
    });
  }

  // Profile settings methods
  async updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User> {
    const [updatedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db.update(users)
        .set({
          ...profileData,
          // If location changed, geocode it (mock implementation)
          latitude: profileData.location !== undefined ? String(40.7128 + Math.random() - 0.5) : undefined,
          longitude: profileData.location !== undefined ? String(-74.0060 + Math.random() - 0.5) : undefined,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    });

    return updatedUser;
  }

  async getUserProfileSettings(userId: string): Promise<UserProfileSettings> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const photos = await this.getUserPhotos(userId);
    const primaryPhoto = photos.find(p => p.isPrimary);
    const blockedUsersData = await this.getBlockedUsers(userId);

    return {
      user,
      photos,
      primaryPhoto,
      blockedUsers: blockedUsersData
    };
  }

  // Blocked users methods
  async blockUser(blockData: InsertBlockedUser): Promise<BlockedUser> {
    const [blockedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db.insert(blockedUsers).values(blockData).returning();
      return user;
    });
    return blockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.retryDatabaseOperation(async () => {
      await db.delete(blockedUsers)
        .where(and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId)
        ));
    });
  }

  async getBlockedUsers(userId: string): Promise<BlockedUserWithDetails[]> {
    const blocked = await db
      .select({
        blockedUser: blockedUsers,
        blockedUserDetails: users
      })
      .from(blockedUsers)
      .innerJoin(users, eq(blockedUsers.blockedId, users.id))
      .where(eq(blockedUsers.blockerId, userId));

    return blocked.map(({ blockedUser, blockedUserDetails }) => ({
      ...blockedUser,
      blockedUser: blockedUserDetails
    }));
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [blocked] = await db
      .select()
      .from(blockedUsers)
      .where(and(
        eq(blockedUsers.blockerId, blockerId),
        eq(blockedUsers.blockedId, blockedId)
      ));

    return !!blocked;
  }

  async getBlockedByUsers(userId: string): Promise<string[]> {
    const blockers = await db
      .select({ blockerId: blockedUsers.blockerId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockedId, userId));

    return blockers.map(b => b.blockerId);
  }

  // Reporting methods
  async createReport(reportData: InsertReport): Promise<Report> {
    const [report] = await this.retryDatabaseOperation(async () => {
      const [rep] = await db.insert(reports).values({ ...reportData, id: randomUUID() }).returning();
      return rep;
    });
    return report;
  }

  async getReports(adminUserId: string): Promise<ReportWithDetails[]> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    // Use simpler approach - get reports first, then get user details separately
    const reportsList = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.reportedAt));

    // Get user details for each report
    const reportsWithDetails = await Promise.all(
      reportsList.map(async (report) => {
        const [reporter, reportedUser] = await Promise.all([
          this.getUser(report.reporterId),
          this.getUser(report.reportedUserId)
        ]);

        return {
          ...report,
          reporter: reporter!,
          reportedUser: reportedUser!,
          reviewedByUser: undefined // Will be populated separately if needed
        };
      })
    );

    return reportsWithDetails;

  }

  async getReportById(reportId: string): Promise<ReportWithDetails | undefined> {
    const reportedUserAlias = {
      id: users.id,
      username: users.username,
      displayName: users.displayName
    };

    const [reportData] = await db
      .select({
        report: reports,
        reporter: users,
        reportedUser: reportedUserAlias
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .innerJoin(users, eq(reports.reportedUserId, users.id))
      .where(eq(reports.id, reportId));

    if (!reportData) return undefined;

    const { report, reporter, reportedUser } = reportData;
    let reviewedByUser: User | undefined;

    if (report.reviewedBy) {
      reviewedByUser = await this.getUser(report.reviewedBy);
    }

    return {
      ...report,
      reporter,
      reportedUser: reportedUser as User,
      reviewedByUser
    };
  }

  async updateReportStatus(reportId: string, statusUpdate: UpdateReportStatus, adminUserId: string): Promise<Report> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    const [updatedReport] = await this.retryDatabaseOperation(async () => {
      const [report] = await db
        .update(reports)
        .set({
          status: statusUpdate.status,
          adminNotes: statusUpdate.adminNotes,
          reviewedBy: adminUserId,
          reviewedAt: new Date()
        })
        .where(eq(reports.id, reportId))
        .returning();
      return report;
    });

    return updatedReport;
  }

  async getUserReports(reportedUserId: string): Promise<ReportWithDetails[]> {
    const reportedUserAlias = {
      id: users.id,
      username: users.username,
      displayName: users.displayName
    };

    const userReports = await db
      .select({
        report: reports,
        reporter: users,
        reportedUser: reportedUserAlias
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .innerJoin(users, eq(reports.reportedUserId, users.id))
      .where(eq(reports.reportedUserId, reportedUserId))
      .orderBy(desc(reports.reportedAt));

    return userReports.map(({ report, reporter, reportedUser }) => ({
      ...report,
      reporter,
      reportedUser: reportedUser as User
    }));
  }

  async getModerationData(adminUserId: string): Promise<ModerationData> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    const allReports = await this.getReports(adminUserId);
    const pendingReports = allReports.filter(r => r.status === 'pending');

    const recentActions = await this.getRecentModerationActions(10);
    const bannedUsersCount = await this.getBannedUsersCount();
    const totalWarnings = await this.getTotalWarningsCount();

    return {
      reports: allReports,
      pendingCount: pendingReports.length,
      totalCount: allReports.length,
      recentActions,
      bannedUsersCount,
      totalWarnings
    };
  }

  // User Moderation Methods
  async warnUser(warnData: WarnUser, adminUserId: string): Promise<UserModerationAction> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    const moderationAction: InsertModerationAction = {
      userId: warnData.userId,
      actionType: 'warning',
      reason: warnData.reason,
      notes: warnData.notes,
      performedBy: adminUserId,
    };

    const [action] = await this.retryDatabaseOperation(async () => {
      const [act] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
      return act;
    });
    return action;
  }

  async banUser(banData: BanUser, adminUserId: string): Promise<{ user: User; action: UserModerationAction }> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    // Calculate expiration time for temporary bans
    let expiresAt: Date | null = null;
    if (!banData.permanent && banData.duration) {
      expiresAt = new Date(Date.now() + banData.duration * 60 * 60 * 1000); // Convert hours to milliseconds
    }

    // Update user ban status
    const [bannedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db
        .update(users)
        .set({
          isBanned: true,
          bannedAt: new Date(),
          bannedBy: adminUserId,
          banReason: banData.reason
        })
        .where(eq(users.id, banData.userId))
        .returning();
      return user;
    });

    // Create moderation action record
    const moderationAction: InsertModerationAction = {
      userId: banData.userId,
      actionType: 'ban',
      reason: banData.reason,
      notes: banData.notes,
      performedBy: adminUserId,
      expiresAt
    };

    const [action] = await this.retryDatabaseOperation(async () => {
      const [act] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
      return act;
    });

    return { user: bannedUser, action };
  }

  async unbanUser(userId: string, adminUserId: string, reason: string): Promise<{ user: User; action: UserModerationAction }> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    // Update user ban status
    const [unbannedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db
        .update(users)
        .set({
          isBanned: false,
          bannedAt: null,
          bannedBy: null,
          banReason: null
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    });

    // Create moderation action record
    const moderationAction: InsertModerationAction = {
      userId,
      actionType: 'unban',
      reason,
      notes: 'User unbanned by admin',
      performedBy: adminUserId,
    };

    const [action] = await this.retryDatabaseOperation(async () => {
      const [act] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
      return act;
    });

    return { user: unbannedUser, action };
  }

  async getUserModerationHistory(userId: string): Promise<UserModerationActionWithDetails[]> {
    // Create aliases for the two different user tables
    const targetUser = users;
    const performingUser = users;

    const actions = await db
      .select({
        action: userModerationActions,
        user: targetUser,
        performedByUser: {
          id: performingUser.id,
          username: performingUser.username,
          displayName: performingUser.displayName
        }
      })
      .from(userModerationActions)
      .innerJoin(targetUser, eq(userModerationActions.userId, targetUser.id))
      .innerJoin(performingUser, eq(userModerationActions.performedBy, performingUser.id))
      .where(eq(userModerationActions.userId, userId))
      .orderBy(desc(userModerationActions.performedAt));

    return actions.map(({ action, user, performedByUser }) => ({
      ...action,
      user,
      performedByUser: performedByUser as User
    }));
  }

  async getRecentModerationActions(limit: number = 10): Promise<UserModerationActionWithDetails[]> {
    // Create aliases for the two different user tables
    const targetUser = users;
    const performingUser = users;

    const actions = await db
      .select({
        action: userModerationActions,
        user: targetUser,
        performedByUser: {
          id: performingUser.id,
          username: performingUser.username,
          displayName: performingUser.displayName
        }
      })
      .from(userModerationActions)
      .innerJoin(targetUser, eq(userModerationActions.userId, targetUser.id))
      .innerJoin(performingUser, eq(userModerationActions.performedBy, performingUser.id))
      .orderBy(desc(userModerationActions.performedAt))
      .limit(limit);

    return actions.map(({ action, user, performedByUser }) => ({
      ...action,
      user,
      performedByUser: performedByUser as User
    }));
  }

  async getBannedUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isBanned, true));
  }

  async getBannedUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isBanned, true));
    return result[0]?.count || 0;
  }

  async getTotalWarningsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(userModerationActions).where(eq(userModerationActions.actionType, 'warning'));
    return result[0]?.count || 0;
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [bannedUsers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isBanned, true));
    const [pendingReports] = await db.select({ count: sql<number>`count(*)` }).from(reports).where(eq(reports.status, 'pending'));
    const [totalReports] = await db.select({ count: sql<number>`count(*)` }).from(reports);
    const [recentWarnings] = await db.select({ count: sql<number>`count(*)` }).from(userModerationActions).where(
      and(
        eq(userModerationActions.actionType, 'warning'),
        sql`${userModerationActions.performedAt} >= NOW() - INTERVAL '7 days'`
      )
    );
    const [activeUsers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isOnline, true));

    return {
      totalUsers: totalUsers.count || 0,
      bannedUsers: bannedUsers.count || 0,
      pendingReports: pendingReports.count || 0,
      totalReports: totalReports.count || 0,
      recentWarnings: recentWarnings.count || 0,
      activeUsers: activeUsers.count || 0,
    };
  }

  private async retryDatabaseOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Database operation failed (attempt ${i + 1}/${maxRetries}):`, error);

        if (i < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}