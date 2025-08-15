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
import { db } from "./db";
import { eq, and, or, desc, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async registerUser(user: RegisterUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const newUser: InsertUser = {
      username: user.username,
      displayName: user.displayName,
      password: hashedPassword,
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

    return await this.createUser(newUser);
  }

  async authenticateUser(credentials: LoginUser): Promise<User | null> {
    const user = await this.getUserByUsername(credentials.username);
    if (!user) return null;

    const isValidPassword = await bcrypt.compare(credentials.password, user.password);
    if (!isValidPassword) return null;

    // Update online status
    await this.updateUserOnlineStatus(user.id, true);

    return user;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    return !user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db.update(users)
      .set({ 
        isOnline,
        lastSeen: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getOnlineUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isOnline, true));
  }

  async getUsersWithDistance(currentUserId: string): Promise<UserWithDistance[]> {
    const allUsers = await db.select().from(users).where(ne(users.id, currentUserId));
    // For now, return users with a mock distance - real implementation would calculate distance
    return allUsers.map(user => ({
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
        user: users
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, roomId));
    
    return members.map(m => m.user);
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
    // Check if private room already exists
    const existingRoom = await this.getPrivateRoom(user1Id, user2Id);
    if (existingRoom) return existingRoom;

    const roomData: InsertRoom = {
      name: `Private Chat`,
      description: 'Private conversation',
      createdBy: user1Id,
      isPrivate: true,
      memberIds: [user1Id, user2Id]
    };

    const room = await this.createRoom(roomData);

    // Add both users as members
    await Promise.all([
      this.addRoomMember({ roomId: room.id, userId: user1Id }),
      this.addRoomMember({ roomId: room.id, userId: user2Id })
    ]);

    return room;
  }

  async getPrivateRoom(user1Id: string, user2Id: string): Promise<Room | undefined> {
    const privateRooms = await db
      .select({ room: rooms })
      .from(rooms)
      .where(eq(rooms.isPrivate, true));

    for (const { room } of privateRooms) {
      const memberIds = room.memberIds || [];
      if (
        memberIds.includes(user1Id) && 
        memberIds.includes(user2Id) && 
        memberIds.length === 2
      ) {
        return room;
      }
    }
    return undefined;
  }

  async getPrivateRooms(userId: string): Promise<PrivateRoom[]> {
    const userRooms = await this.getUserRooms(userId);
    const privateRooms = userRooms.filter(room => room.isPrivate);

    const privateRoomsWithOtherUser: PrivateRoom[] = [];
    
    for (const room of privateRooms) {
      const otherUserId = room.memberIds?.find(id => id !== userId);
      if (otherUserId) {
        const otherUser = await this.getUser(otherUserId);
        if (otherUser) {
          privateRoomsWithOtherUser.push({
            id: room.id,
            participant1Id: room.memberIds![0],
            participant2Id: room.memberIds![1],
            participant1: room.memberIds![0] === userId ? (await this.getUser(room.memberIds![1]))! : (await this.getUser(room.memberIds![0]))!,
            participant2: otherUser
          });
        }
      }
    }

    return privateRoomsWithOtherUser;
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

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values({ ...message, id: randomUUID() }).returning();
    return newMessage;
  }

  async getRoomMessages(roomId: string, limit: number = 50): Promise<MessageWithUser[]> {
    const roomMessages = await db
      .select({
        message: messages,
        user: users
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return roomMessages.map(({ message, user }) => ({
      ...message,
      user
    })).reverse(); // Reverse to show oldest first
  }

  // Photo methods
  async addUserPhoto(photoData: InsertUserPhoto): Promise<UserPhoto> {
    const [newPhoto] = await db.insert(userPhotos).values(photoData).returning();
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
      primaryPhoto
    };
  }

  async deleteUserPhoto(photoId: string, userId: string): Promise<void> {
    await db.delete(userPhotos)
      .where(and(
        eq(userPhotos.id, photoId),
        eq(userPhotos.userId, userId)
      ));
  }

  async setPrimaryPhoto(photoId: string, userId: string): Promise<void> {
    // First, unset all primary photos for this user
    await db.update(userPhotos)
      .set({ isPrimary: false })
      .where(eq(userPhotos.userId, userId));

    // Then set the selected photo as primary
    await db.update(userPhotos)
      .set({ isPrimary: true })
      .where(and(
        eq(userPhotos.id, photoId),
        eq(userPhotos.userId, userId)
      ));
  }

  // Profile settings methods
  async updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({
        ...profileData,
        // If location changed, geocode it (mock implementation)
        latitude: profileData.location !== undefined ? String(40.7128 + Math.random() - 0.5) : undefined,
        longitude: profileData.location !== undefined ? String(-74.0060 + Math.random() - 0.5) : undefined,
      })
      .where(eq(users.id, userId))
      .returning();

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
    const [blockedUser] = await db.insert(blockedUsers).values(blockData).returning();
    return blockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.delete(blockedUsers)
      .where(and(
        eq(blockedUsers.blockerId, blockerId),
        eq(blockedUsers.blockedId, blockedId)
      ));
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
}