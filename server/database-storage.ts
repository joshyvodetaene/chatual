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
  users,
  rooms,
  messages,
  roomMembers,
  userPhotos,
  blockedUsers,
  reports,
  userModerationActions,
  userNotificationSettings,
  notifications,
  type UserNotificationSettings,
  type UpdateNotificationSettings,
  type Notification,
  type InsertNotification,
  type FriendRequest,
  type InsertFriendRequest,
  type FriendRequestWithUser,
  type Friendship,
  type InsertFriendship,
  type FriendshipWithUser,
  type UserWithFriendStatus,
  type UserPrivacySettings,
  type InsertPrivacySettings,
  type UpdatePrivacySettings,
  type UserRole,
  type Permission,
  hasPermission,
  hasMinimumRole,
  USER_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  friendRequests,
  friendships,
  userPrivacySettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, ne, sql, gt, lt, gte, like, ilike, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Database is already initialized in db.ts
    this.setupConnectionErrorHandling();
    // Initialize default data asynchronously to avoid blocking constructor
    setTimeout(() => {
      this.ensureDefaultRooms();
      this.ensureAdministratorUser();
      this.ensureAdminRoleAssignments();
    }, 100);
  }

  private async ensureDefaultRooms(): Promise<void> {
    try {
      // Check if default rooms exist
      const existingRooms = await db.select().from(rooms);

      const defaultRoomData = [
        {
          name: "Flirt",
          description: "Connect and flirt with other users",
        },
        {
          name: "Sub & dom",
          description: "Explore power dynamics and relationships",
        },
        {
          name: "Whispering",
          description: "Intimate conversations and secrets",
        },
        {
          name: "Shades of senses",
          description: "Explore sensory experiences and connections",
        },
      ];

      // Create any missing default rooms
      for (const roomData of defaultRoomData) {
        const roomExists = existingRooms.some(room => room.name === roomData.name);
        if (!roomExists) {
          await db.insert(rooms).values({
            name: roomData.name,
            description: roomData.description,
            isPrivate: false,
            memberIds: [],
            createdBy: null,
          });
          console.log(`Created persistent room: ${roomData.name}`);
        }
      }
    } catch (error) {
      console.error('Error ensuring default rooms:', error);
    }
  }

  private async ensureAdministratorUser(): Promise<void> {
    try {
      // Check if administrator user exists
      const adminUser = await this.getUserByUsername('administrator');

      // SECURITY: Admin user creation disabled in production
      // To create an admin user, use proper admin setup procedures
      if (process.env.NODE_ENV === 'development' && process.env.CREATE_DEV_ADMIN === 'true') {
        if (!adminUser) {
          // For development only - require explicit environment variable
          const devPassword = process.env.DEV_ADMIN_PASSWORD;
          if (!devPassword || devPassword.length < 12) {
            console.warn('[SECURITY] DEV_ADMIN_PASSWORD environment variable required (min 12 chars) for development admin creation');
            return;
          }

          const hashedPassword = await bcrypt.hash(devPassword, 10);
          const adminUserId = randomUUID();

          const masterAdmin = {
            id: adminUserId,
            username: 'admin',
            displayName: 'Administrator',
            password: hashedPassword,
            gender: 'male' as const,
            location: 'System',
            latitude: null,
            longitude: null,
            genderPreference: 'all' as const,
            ageMin: 18,
            ageMax: 99,
            role: 'admin' as const,
            avatar: null,
            bio: 'System Administrator',
            dateOfBirth: null,
            isOnline: false,
            lastSeen: new Date(),
            age: 25,
            isBanned: false,
            bannedAt: null,
            bannedBy: null,
            banReason: null,
          };

          await db.insert(users).values([masterAdmin]);
          console.log('[DEV] Development admin user created with environment password');
        }
      } else {
        console.log('[SECURITY] Admin user creation disabled outside development environment');
      }
    } catch (error) {
      console.error('Error ensuring administrator user:', error);
    }
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

  // =====================================
  // RBAC (Role-Based Access Control) Methods
  // =====================================

  /**
   * Check if a user has a specific permission
   */
  hasUserPermission(userRole: UserRole, permission: Permission): boolean {
    return hasPermission(userRole, permission);
  }

  /**
   * Check if user has minimum role level
   */
  hasMinimumUserRole(userRole: UserRole, minimumRole: UserRole): boolean {
    return hasMinimumRole(userRole, minimumRole);
  }

  /**
   * Validate admin access with specific permission
   */
  validateAdminAccess(adminUser: { role: UserRole }, requiredPermission: Permission): boolean {
    if (!adminUser || !adminUser.role) {
      console.warn('[RBAC] Admin user or role missing in access validation');
      return false;
    }

    const hasAccess = this.hasUserPermission(adminUser.role as UserRole, requiredPermission);
    
    if (!hasAccess) {
      console.warn(`[RBAC] Access denied: Admin role '${adminUser.role}' lacks permission '${requiredPermission}'`);
    }

    return hasAccess;
  }

  /**
   * Get admin user permissions
   */
  getAdminPermissions(userRole: UserRole): Permission[] {
    // Use static import that was already imported at the top
    return ROLE_PERMISSIONS[userRole] || [];
  }

  /**
   * Assign role to admin user
   */
  async assignAdminRole(adminId: string, role: UserRole, assignedBy: string, reason?: string): Promise<void> {
    try {
      const { adminUsers } = await import('@shared/schema');
      
      await db
        .update(adminUsers)
        .set({ 
          role: role,
          lastLogin: new Date() // Track when role was updated
        })
        .where(eq(adminUsers.id, adminId));

      console.log(`[RBAC] Role '${role}' assigned to admin '${adminId}' by '${assignedBy}'`);
      if (reason) {
        console.log(`[RBAC] Assignment reason: ${reason}`);
      }
    } catch (error) {
      console.error(`[RBAC] Error assigning role '${role}' to admin '${adminId}':`, error);
      throw error;
    }
  }

  /**
   * SECURITY: Update existing admin roles only - NO auto-creation
   */
  async ensureAdminRoleAssignments(): Promise<void> {
    try {
      const { adminUsers } = await import('@shared/schema');
      
      // SECURITY: Only update existing admins, never create new ones
      // Find admins without roles and assign default admin role
      const adminsWithoutRoles = await db
        .select()
        .from(adminUsers)
        .where(or(eq(adminUsers.role, ''), isNull(adminUsers.role)));

      for (const admin of adminsWithoutRoles) {
        await db
          .update(adminUsers)
          .set({ role: USER_ROLES.ADMIN })
          .where(eq(adminUsers.id, admin.id));
        
        console.log(`[RBAC] Updated existing admin '${admin.username}' with default admin role`);
      }

      console.log(`[RBAC] Admin role assignment check completed`);
    } catch (error) {
      console.error('[RBAC] Error ensuring admin role assignments:', error);
      throw error;
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
    console.log(`[DB] Fetching online users (excluding admin users)`);
    try {
      const onlineUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.isOnline, true),
          ne(users.role, 'admin'), // Exclude admin users for security
          ne(users.role, 'system') // Exclude system users for security
        ));
      console.log(`[DB] Found ${onlineUsers.length} online users (admin users excluded)`);
      return onlineUsers;
    } catch (error) {
      console.error(`[DB] Error fetching online users:`, error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    console.log(`[DB] Fetching all users (excluding admin users)`);
    try {
      const allUsers = await db
        .select()
        .from(users)
        .where(and(ne(users.role, 'admin'), ne(users.role, 'system'))); // Exclude admin and system users for security
      console.log(`[DB] Found ${allUsers.length} total users (admin users excluded)`);
      return allUsers;
    } catch (error) {
      console.error(`[DB] Error fetching all users:`, error);
      throw error;
    }
  }

  async getUsersWithDistance(currentUserId: string): Promise<UserWithDistance[]> {
    try {
      // Get current user's coordinates
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, currentUserId));

      if (!currentUser) {
        console.error(`[API] Current user not found: ${currentUserId}`);
        throw new Error('User not found');
      }

      const currentLat = parseFloat(currentUser.latitude || '0');
      const currentLng = parseFloat(currentUser.longitude || '0');

      // Get all users with their photos
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          password: users.password,
          age: users.age,
          gender: users.gender,
          location: users.location,
          latitude: users.latitude,
          longitude: users.longitude,
          genderPreference: users.genderPreference,
          ageMin: users.ageMin,
          ageMax: users.ageMax,
          role: users.role,
          avatar: users.avatar,
          bio: users.bio,
          dateOfBirth: users.dateOfBirth,
          lastSeen: users.lastSeen,
          isOnline: users.isOnline,
          isBanned: users.isBanned,
          bannedAt: users.bannedAt,
          bannedBy: users.bannedBy,
          banReason: users.banReason,
          photoId: sql<string | null>`${userPhotos.id}`,
          photoUrl: sql<string | null>`${userPhotos.photoUrl}`,
          photoFileName: sql<string | null>`${userPhotos.fileName}`,
          photoIsPrimary: sql<boolean | null>`${userPhotos.isPrimary}`,
        })
        .from(users)
        .leftJoin(userPhotos, and(
          eq(userPhotos.userId, users.id),
          eq(userPhotos.isPrimary, true)
        ))
        .where(and(
          ne(users.id, currentUserId),
          eq(users.isBanned, false),
          ne(users.role, 'admin'), // Exclude admin users for security
          ne(users.role, 'system') // Exclude system users for security
        ));

      // Prepare destinations for batch distance calculation
      const destinations = allUsers
        .map(user => {
          const userLat = parseFloat(user.latitude || '0');
          const userLng = parseFloat(user.longitude || '0');
          
          // Only include users with valid coordinates
          if (
            userLat !== 0 && userLng !== 0 &&
            !isNaN(userLat) && !isNaN(userLng) &&
            Math.abs(userLat) <= 90 && Math.abs(userLng) <= 180
          ) {
            return {
              lat: userLat,
              lng: userLng,
              userId: user.id
            };
          }
          return null;
        })
        .filter((dest): dest is { lat: number; lng: number; userId: string } => dest !== null);

      // Get distances using Google Maps API (batch calculation)
      let distanceResults = new Map();
      if (
        currentLat !== 0 && currentLng !== 0 &&
        !isNaN(currentLat) && !isNaN(currentLng) &&
        Math.abs(currentLat) <= 90 && Math.abs(currentLng) <= 180 &&
        destinations.length > 0
      ) {
        try {
          const { GeocodingService } = await import('./geocoding-service');
          distanceResults = await GeocodingService.getBatchDistances(
            currentLat,
            currentLng,
            destinations
          );
        } catch (error) {
          console.error('[API] Error calculating batch distances:', error);
          // Fallback to Haversine calculation
          for (const dest of destinations) {
            distanceResults.set(dest.userId, {
              distance: this.calculateDistance(currentLat, currentLng, dest.lat, dest.lng),
              duration: 0,
              mode: 'straight_line'
            });
          }
        }
      }

      // Transform to UserWithDistance
      const usersWithDistance: UserWithDistance[] = allUsers.map(user => {
        const distanceData = distanceResults.get(user.id);
        

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          password: user.password,
          age: user.age,
          gender: user.gender,
          location: user.location,
          latitude: user.latitude,
          longitude: user.longitude,
          genderPreference: user.genderPreference,
          ageMin: user.ageMin,
          ageMax: user.ageMax,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          dateOfBirth: user.dateOfBirth,
          lastSeen: user.lastSeen ? new Date(user.lastSeen) : null,
          isOnline: user.isOnline,
          isBanned: user.isBanned,
          bannedAt: user.bannedAt,
          bannedBy: user.bannedBy,
          banReason: user.banReason,
          primaryPhoto: user.photoUrl ? {
            id: user.photoId || '',
            userId: user.id,
            photoUrl: user.photoUrl,
            fileName: user.photoFileName || '',
            isPrimary: user.photoIsPrimary || false,
            uploadedAt: new Date(),
          } : null,
          distance: distanceData?.distance,
          duration: distanceData?.duration,
          distanceMode: distanceData?.mode,
        };
      });

      return usersWithDistance;

    } catch (error) {
      console.error('Error in getUsersWithDistance:', error);
      throw error;
    }
  }

  // Room methods
  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async getRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isPrivate, false));
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

    // Protect core persistent rooms from deletion
    const protectedRoomNames = ['Flirt', 'Sub & dom', 'Whispering', 'Shades of senses'];
    if (protectedRoomNames.includes(room.name)) {
      throw new Error(`Cannot delete persistent room: ${room.name}. This room is protected and must always exist.`);
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
        console.log(`[DB] Private room ${room.id}: ${currentUser.username} <-> ${otherUser.username}`);
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

  async deletePrivateRoom(roomId: string, userId: string): Promise<{ success: boolean; otherParticipant?: User }> {
    console.log(`[DB] Attempting to delete private room ${roomId} by user ${userId}`);

    // First verify that this is a private room and the user is a member
    const room = await db
      .select()
      .from(rooms)
      .where(and(
        eq(rooms.id, roomId),
        eq(rooms.isPrivate, true)
      ));

    console.log(`[DB] Found ${room.length} rooms matching roomId ${roomId}`);
    if (room.length > 0) {
      console.log(`[DB] Room memberIds: ${JSON.stringify(room[0].memberIds)}, checking for userId: ${userId}`);
      console.log(`[DB] User authorized: ${room[0].memberIds?.includes(userId)}`);
    }

    // Check if user is a member using the roomMembers table instead of memberIds field
    const userMembership = await db
      .select()
      .from(roomMembers)
      .where(and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ));

    console.log(`[DB] User membership check: found ${userMembership.length} membership records for user ${userId} in room ${roomId}`);

    if (!room.length || userMembership.length === 0) {
      console.log(`[DB] Authorization failed for deleting private room ${roomId} by user ${userId}`);
      return { success: false }; // User not authorized to delete this room
    }

    // Get room members to find the other participant
    const roomMembersData = await this.getRoomMembers(roomId);
    const otherParticipant = roomMembersData.find(member => member.id !== userId);

    // Delete all messages in this room first
    await db.delete(messages).where(eq(messages.roomId, roomId));

    // Delete all room members
    await db.delete(roomMembers).where(eq(roomMembers.roomId, roomId));

    // Delete the room itself
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return { success: true, otherParticipant };
  }

  async getRoomsAndPrivateRooms(userId: string): Promise<PrivateChatData> {
    const allRooms = await this.getRooms();
    const privateRooms = await this.getPrivateRooms(userId);

    return {
      rooms: allRooms,
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
      .orderBy(desc(messages.sequenceId))
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
        ilike(users.username, `%${query}%`)
      )
    ];

    // Exclude current user from search results
    if (currentUserId) {
      whereConditions.push(ne(users.id, currentUserId));
    }

    // Exclude banned users
    whereConditions.push(eq(users.isBanned, false));
    
    // Exclude admin users for security
    whereConditions.push(ne(users.role, 'admin'));
    whereConditions.push(ne(users.role, 'system'));

    const searchResults = await db
      .select()
      .from(users)
      .where(and(...whereConditions))
      .orderBy(desc(users.isOnline), users.username)
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




  // Message methods
  async createMessage(data: InsertMessage): Promise<MessageWithUser> {
    console.log(`[STORAGE] Creating message - userId: ${data.userId}, roomId: ${data.roomId}, messageType: ${data.messageType}, hasPhoto: ${!!data.photoUrl}`);

    // Get the next sequence ID
    const nextSeqId = await this.getNextSequenceId();
    const messageData = {
      ...data,
      sequenceId: nextSeqId
    };

    const message = await this.retryDatabaseOperation(async () => {
      const [msg] = await db.insert(messages).values(messageData).returning();
      return msg;
    });

    console.log(`[STORAGE] Message created with ID: ${message.id}, sequenceId: ${message.sequenceId}, messageType: ${message.messageType}`);

    const user = await this.getUser(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    console.log(`[STORAGE] Returning message with user data:`, {
      messageId: message.id,
      sequenceId: message.sequenceId,
      messageType: message.messageType,
      photoUrl: message.photoUrl,
      userName: user.username
    });

    return { ...message, user };
  }

  private async getNextSequenceId(): Promise<number> {
    try {
      const result = await db.execute(sql`SELECT nextval('messages_sequence_seq')`);
      return result.rows[0].nextval as number;
    } catch (error) {
      // If sequence doesn't exist, create it and try again
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.log('[DB] Creating missing messages_sequence_seq');
        await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS messages_sequence_seq START 1`);
        const result = await db.execute(sql`SELECT nextval('messages_sequence_seq')`);
        return result.rows[0].nextval as number;
      }
      throw error;
    }
  }

  async getRoomMessages(roomId: string, pagination: PaginationParams = {}): Promise<PaginatedResponse<MessageWithUser>> {
    const { limit = 20, before, after } = pagination;

    // Calculate 3 hours ago timestamp
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Build base condition with 3-hour time filter
    let whereCondition = and(
      eq(messages.roomId, roomId),
      gte(messages.createdAt, threeHoursAgo)
    )!;

    // Add cursor-based pagination conditions using sequenceId
    if (before) {
      // Parse sequenceId from before cursor
      const beforeSeqId = parseInt(before);
      if (!isNaN(beforeSeqId)) {
        whereCondition = and(
          eq(messages.roomId, roomId),
          gte(messages.createdAt, threeHoursAgo),
          gt(messages.sequenceId, beforeSeqId)
        )!;
      }
    } else if (after) {
      // Parse sequenceId from after cursor
      const afterSeqId = parseInt(after);
      if (!isNaN(afterSeqId)) {
        whereCondition = and(
          eq(messages.roomId, roomId),
          gte(messages.createdAt, threeHoursAgo),
          lt(messages.sequenceId, afterSeqId)
        )!;
      }
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
      .orderBy(desc(messages.sequenceId)) // Order by sequenceId for consistent ordering
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

    // Generate cursors using sequenceId
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].message.sequenceId?.toString() : undefined;
    const prevCursor = items.length > 0 ? items[0].message.sequenceId?.toString() : undefined;

    return {
      items: messagesWithUser,
      hasMore,
      nextCursor,
      prevCursor
    };
  }

  async getMessageById(messageId: string): Promise<MessageWithUser | undefined> {
    try {
      const result = await db
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
        .where(eq(messages.id, messageId))
        .limit(1);

      if (result.length === 0) {
        return undefined;
      }

      const { message, user, photo } = result[0];
      return {
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
      };
    } catch (error) {
      console.error('Error getting message by ID:', error);
      return undefined;
    }
  }

  async clearAllMessages(): Promise<boolean> {
    try {
      console.log('[DB] Clearing all messages from database');


      // Then delete all messages
      const result = await this.retryDatabaseOperation(async () => {
        const res = await db.delete(messages);
        return res;
      });

      console.log(`[DB] Cleared all messages successfully. Rows affected: ${result.rowCount}`);
      return true;
    } catch (error) {
      console.error('[DB] Error clearing all messages:', error);
      return false;
    }
  }

  async cleanupOldMessages(keepPerRoom: number = 40): Promise<{ totalDeleted: number; roomsCleaned: number }> {
    try {
      console.log(`[DB] Starting cleanup of old messages, keeping ${keepPerRoom} messages per room`);

      // Get all rooms
      const allRooms = await this.retryDatabaseOperation(async () => {
        return await db.select({ id: rooms.id }).from(rooms);
      });

      let totalDeleted = 0;
      let roomsCleaned = 0;

      for (const room of allRooms) {
        try {
          // Get messages for this room, ordered by createdAt DESC
          const roomMessages = await this.retryDatabaseOperation(async () => {
            return await db
              .select({ id: messages.id, sequenceId: messages.sequenceId, createdAt: messages.createdAt })
              .from(messages)
              .where(eq(messages.roomId, room.id))
              .orderBy(desc(messages.sequenceId));
          });

          // If room has more than keepPerRoom messages, delete the older ones
          if (roomMessages.length > keepPerRoom) {
            const messagesToDelete = roomMessages.slice(keepPerRoom);
            const messageIdsToDelete = messagesToDelete.map(m => m.id);

            console.log(`[DB] Room ${room.id}: Found ${roomMessages.length} messages, deleting ${messagesToDelete.length} old messages`);


            // Then delete the old messages
            const deleteResult = await this.retryDatabaseOperation(async () => {
              return await db.delete(messages).where(
                inArray(messages.id, messageIdsToDelete)
              );
            });

            totalDeleted += deleteResult.rowCount || 0;
            roomsCleaned++;
            console.log(`[DB] Room ${room.id}: Deleted ${deleteResult.rowCount} old messages`);
          }
        } catch (error) {
          console.error(`[DB] Error cleaning up messages for room ${room.id}:`, error);
          // Continue with other rooms even if one fails
        }
      }

      console.log(`[DB] Cleanup completed: ${totalDeleted} messages deleted from ${roomsCleaned} rooms`);
      return { totalDeleted, roomsCleaned };
    } catch (error) {
      console.error('[DB] Error during message cleanup:', error);
      throw error;
    }
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
      return [user];
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

  // Get or create a secure system user for admin actions
  private async getOrCreateSystemUser(): Promise<User> {
    // Try to find existing system user by role
    const existingSystemUsers = await db.select().from(users).where(eq(users.role, 'system')).limit(1);
    if (existingSystemUsers.length > 0) {
      return existingSystemUsers[0];
    }

    // Create a secure system user
    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    
    const systemUserData = {
      username: `system_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      displayName: 'System Administrator',
      password: hashedPassword,
      age: 25,
      gender: 'other' as const,
      location: 'System',
      role: 'system'
    };
    
    const [createdUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db.insert(users).values(systemUserData).returning();
      return [user];
    });
    return createdUser;
  }

  // Blocked users methods
  async blockUser(blockData: InsertBlockedUser): Promise<BlockedUser> {
    // Protect administrator user from being blocked
    const targetUser = await this.getUser(blockData.blockedId);
    if (targetUser && targetUser.username === 'administrator') {
      throw new Error('Cannot block the administrator user. This account is protected.');
    }

    // Check if blocker is an admin (admin users are in separate table)
    const isAdminBlocker = await this.getAdminUser(blockData.blockerId);
    if (isAdminBlocker) {
      // For admin blocks, use secure system user to satisfy foreign key constraint
      const systemUser = await this.getOrCreateSystemUser();
      
      const systemUserBlockData = {
        ...blockData,
        blockerId: systemUser.id
      };
      
      const [blockedUser] = await this.retryDatabaseOperation(async () => {
        const [user] = await db.insert(blockedUsers).values(systemUserBlockData).returning();
        return [user];
      });

      // Create audit trail for admin block action
      const moderationAction: InsertModerationAction = {
        userId: blockData.blockedId,
        actionType: 'block',
        reason: blockData.reason || 'User blocked by admin',
        performedBy: systemUser.id,
        metadata: { 
          adminUserId: blockData.blockerId, 
          adminUsername: isAdminBlocker.username,
          actionType: 'admin_block'
        }
      };

      await this.retryDatabaseOperation(async () => {
        await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() });
      });

      return blockedUser;
    }

    const [blockedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db.insert(blockedUsers).values(blockData).returning();
      return [user];
    });
    return blockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    console.log(`[DB] Unblocking user: ${blockedId} by ${blockerId}`);
    try {
      // Check if blocker is an admin (admin users are in separate table)
      let actualBlockerId = blockerId;
      const isAdminBlocker = await this.getAdminUser(blockerId);
      if (isAdminBlocker) {
        // For admin unblocks, use system user ID
        const systemUser = await this.getOrCreateSystemUser();
        actualBlockerId = systemUser.id;
      }

      // First check if the block relationship exists
      const existingBlock = await db
        .select()
        .from(blockedUsers)
        .where(and(
          eq(blockedUsers.blockerId, actualBlockerId),
          eq(blockedUsers.blockedId, blockedId)
        ))
        .limit(1);

      if (existingBlock.length === 0) {
        console.log(`[DB] No block relationship found to unblock`);
        return false;
      }

      await this.retryDatabaseOperation(async () => {
        await db.delete(blockedUsers)
          .where(and(
            eq(blockedUsers.blockerId, actualBlockerId),
            eq(blockedUsers.blockedId, blockedId)
          ));
      });

      // Create audit trail for admin unblock action if performed by admin
      if (isAdminBlocker) {
        const systemUser = await this.getOrCreateSystemUser();
        const moderationAction: InsertModerationAction = {
          userId: blockedId,
          actionType: 'unblock',
          reason: 'User unblocked by admin',
          performedBy: systemUser.id,
          metadata: { 
            adminUserId: blockerId, 
            adminUsername: isAdminBlocker.username,
            actionType: 'admin_unblock'
          }
        };

        await this.retryDatabaseOperation(async () => {
          await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() });
        });
      }

      console.log(`[DB] Successfully unblocked user ${blockedId}`);
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      return false;
    }
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
      return [rep];
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
      return [report];
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
    // Check if user is admin using the admin_users table
    const admin = await this.getAdminUser(adminUserId);
    if (!admin || !admin.isActive) {
      throw new Error('Access denied: Admin privileges required');
    }

    // Use system user for performedBy to satisfy foreign key constraint
    const systemUser = await this.getOrCreateSystemUser();

    const moderationAction: InsertModerationAction = {
      userId: warnData.userId,
      actionType: 'warning',
      reason: warnData.reason,
      notes: warnData.notes,
      performedBy: systemUser.id,
      metadata: { adminUserId, adminUsername: admin.username } // Store real admin info
    };

    const [action] = await this.retryDatabaseOperation(async () => {
      const [act] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
      return [act];
    });
    return action;
  }

  async banUser(banData: BanUser, adminUserId: string): Promise<{ user: User; action: UserModerationAction }> {
    // Check if user is admin using the admin_users table
    const admin = await this.getAdminUser(adminUserId);
    if (!admin || !admin.isActive) {
      throw new Error('Access denied: Admin privileges required');
    }

    // Protect administrator user from being banned
    const targetUser = await this.getUser(banData.userId);
    if (targetUser && targetUser.username === 'administrator') {
      throw new Error('Cannot ban the administrator user. This account is protected and must always remain active.');
    }

    // Calculate expiration time for temporary bans
    let expiresAt: Date | null = null;
    if (!banData.permanent && banData.duration) {
      expiresAt = new Date(Date.now() + banData.duration * 60 * 60 * 1000); // Convert hours to milliseconds
    }

    // Use system user for bannedBy to satisfy foreign key constraint
    const systemUser = await this.getOrCreateSystemUser();

    // Update user ban status
    const [bannedUser] = await this.retryDatabaseOperation(async () => {
      const [user] = await db
        .update(users)
        .set({
          isBanned: true,
          bannedAt: new Date(),
          bannedBy: systemUser.id,
          banReason: banData.reason
        })
        .where(eq(users.id, banData.userId))
        .returning();
      return [user];
    });

    // Create moderation action record
    const moderationAction: InsertModerationAction = {
      userId: banData.userId,
      actionType: 'ban',
      reason: banData.reason,
      notes: banData.notes,
      performedBy: systemUser.id,
      expiresAt,
      metadata: { adminUserId, adminUsername: admin.username } // Store real admin info
    };

    const [action] = await this.retryDatabaseOperation(async () => {
      const [act] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
      return [act];
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
      return [user];
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
      return [act];
    });

    return { user: unbannedUser, action };
  }

  async getUserModerationHistory(userId: string): Promise<UserModerationActionWithDetails[]> {
    console.log(`[DB] Fetching moderation history for user: ${userId}`);
    try {
      // Simple implementation without complex joins to avoid alias conflicts
      const actions = await db
        .select()
        .from(userModerationActions)
        .where(eq(userModerationActions.userId, userId))
        .orderBy(desc(userModerationActions.performedAt));

      // Fetch user details separately to avoid alias conflicts
      const actionsWithDetails = await Promise.all(
        actions.map(async (action) => {
          const [targetUser, performingUser] = await Promise.all([
            this.getUser(action.userId),
            this.getUser(action.performedBy)
          ]);

          return {
            ...action,
            user: targetUser as User,
            performedByUser: performingUser as User
          };
        })
      );

      console.log(`[DB] Found ${actionsWithDetails.length} moderation actions for user ${userId}`);
      return actionsWithDetails;
    } catch (error) {
      console.error(`[DB] Error fetching moderation history for user ${userId}:`, error);
      throw error;
    }
  }

  async getRecentModerationActions(limit: number = 10): Promise<UserModerationActionWithDetails[]> {
    console.log(`[DB] Fetching recent moderation actions (limit: ${limit})`);
    try {
      // Simple implementation without complex joins to avoid alias conflicts
      const actions = await db
        .select()
        .from(userModerationActions)
        .orderBy(desc(userModerationActions.performedAt))
        .limit(limit);

      // Fetch user details separately to avoid alias conflicts
      const actionsWithDetails = await Promise.all(
        actions.map(async (action) => {
          const [targetUser, performingUser] = await Promise.all([
            this.getUser(action.userId),
            this.getUser(action.performedBy)
          ]);

          return {
            ...action,
            user: targetUser as User,
            performedByUser: performingUser as User
          };
        })
      );

      console.log(`[DB] Found ${actionsWithDetails.length} moderation actions`);
      return actionsWithDetails;
    } catch (error) {
      console.error(`[DB] Error fetching recent moderation actions:`, error);
      throw error;
    }
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


  // Friend methods
  async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    // Check if users are already friends or have pending request
    const existingFriendship = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendships)
        .where(or(
          and(eq(friendships.user1Id, senderId), eq(friendships.user2Id, receiverId)),
          and(eq(friendships.user1Id, receiverId), eq(friendships.user2Id, senderId))
        ));
    });

    if (existingFriendship.length > 0) {
      throw new Error('Users are already friends');
    }

    const existingRequest = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendRequests)
        .where(and(
          eq(friendRequests.senderId, senderId),
          eq(friendRequests.receiverId, receiverId),
          eq(friendRequests.status, 'pending')
        ));
    });

    if (existingRequest.length > 0) {
      throw new Error('Friend request already sent');
    }

    const [request] = await this.retryDatabaseOperation(async () => {
      return await db.insert(friendRequests)
        .values({
          senderId,
          receiverId,
          status: 'pending'
        })
        .returning();
    });

    // Get sender details for notification
    const [sender] = await this.retryDatabaseOperation(async () => {
      return await db.select().from(users).where(eq(users.id, senderId));
    });

    // Create notification for receiver
    await this.createNotification({
      userId: receiverId,
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${sender?.username || 'Someone'} sent you a friend request`,
      data: {
        senderId,
        requestId: request.id,
        senderUsername: sender?.username
      }
    });

    return request;
  }

  async getFriendRequests(userId: string): Promise<FriendRequestWithUser[]> {
    return await this.retryDatabaseOperation(async () => {
      const requests = await db
        .select({
          id: friendRequests.id,
          senderId: friendRequests.senderId,
          receiverId: friendRequests.receiverId,
          status: friendRequests.status,
          createdAt: friendRequests.createdAt,
          respondedAt: friendRequests.respondedAt,
        })
        .from(friendRequests)
        .where(and(
          eq(friendRequests.receiverId, userId),
          eq(friendRequests.status, 'pending')
        ))
        .orderBy(desc(friendRequests.createdAt));

      console.log(`[DB] Found ${requests.length} pending friend requests for user ${userId}`);

      // Fetch sender and receiver details separately
      const requestsWithUsers = await Promise.all(
        requests.map(async (request) => {
          const [sender] = await db.select().from(users).where(eq(users.id, request.senderId));
          const [receiver] = await db.select().from(users).where(eq(users.id, request.receiverId));

          console.log(`[DB] Friend request ${request.id}: sender=${sender?.username}, receiver=${receiver?.username}`);

          return {
            ...request,
            sender: sender,
            receiver: receiver
          };
        })
      );

      return requestsWithUsers as FriendRequestWithUser[];
    });
  }

  async getSentFriendRequests(userId: string): Promise<FriendRequestWithUser[]> {
    return await this.retryDatabaseOperation(async () => {
      const requests = await db
        .select({
          id: friendRequests.id,
          senderId: friendRequests.senderId,
          receiverId: friendRequests.receiverId,
          status: friendRequests.status,
          createdAt: friendRequests.createdAt,
          respondedAt: friendRequests.respondedAt,
        })
        .from(friendRequests)
        .where(and(
          eq(friendRequests.senderId, userId),
          eq(friendRequests.status, 'pending')
        ))
        .orderBy(desc(friendRequests.createdAt));

      console.log(`[DB] Found ${requests.length} sent friend requests for user ${userId}`);

      // Fetch sender and receiver details separately
      const requestsWithUsers = await Promise.all(
        requests.map(async (request) => {
          const [sender] = await db.select().from(users).where(eq(users.id, request.senderId));
          const [receiver] = await db.select().from(users).where(eq(users.id, request.receiverId));

          console.log(`[DB] Sent friend request ${request.id}: sender=${sender?.username}, receiver=${receiver?.username}`);

          return {
            ...request,
            sender: sender,
            receiver: receiver
          };
        })
      );

      return requestsWithUsers as FriendRequestWithUser[];
    });
  }

  async cancelFriendRequest(requestId: string, userId: string): Promise<boolean> {
    return await this.retryDatabaseOperation(async () => {
      // First verify the user owns this friend request
      const [request] = await db.select().from(friendRequests)
        .where(and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.senderId, userId),
          eq(friendRequests.status, 'pending')
        ));

      if (!request) {
        throw new Error('Friend request not found or cannot be cancelled');
      }

      // Delete the friend request
      await db.delete(friendRequests)
        .where(eq(friendRequests.id, requestId));

      return true;
    });
  }

  async respondToFriendRequest(requestId: string, action: 'accept' | 'decline'): Promise<boolean> {
    const [request] = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendRequests)
        .where(eq(friendRequests.id, requestId));
    });

    if (!request || request.status !== 'pending') {
      throw new Error('Friend request not found or already responded to');
    }

    if (action === 'accept') {
      // Create friendship first
      await this.retryDatabaseOperation(async () => {
        return await db.insert(friendships)
          .values({
            user1Id: request.senderId,
            user2Id: request.receiverId
          });
      });

      console.log(`[DB] Created friendship between ${request.senderId} and ${request.receiverId}`);

      // Notify sender that request was accepted
      await this.createNotification({
        userId: request.senderId,
        type: 'friend_request',
        title: 'Friend Request Accepted',
        body: 'Your friend request was accepted',
        data: {
          friendId: request.receiverId
        }
      });
    }

    // Delete the friend request (don't just update status)
    await this.retryDatabaseOperation(async () => {
      return await db.delete(friendRequests)
        .where(eq(friendRequests.id, requestId));
    });

    console.log(`[DB] Friend request ${requestId} ${action === 'accept' ? 'accepted and deleted' : 'declined and deleted'}`);

    return true;
  }

  async getFriends(userId: string): Promise<FriendshipWithUser[]> {
    return await this.retryDatabaseOperation(async () => {
      // Get friendships where user is user1
      const friendships1 = await db
        .select({
          id: friendships.id,
          user1Id: friendships.user1Id,
          user2Id: friendships.user2Id,
          createdAt: friendships.createdAt,
          friend: users,
          photo: userPhotos
        })
        .from(friendships)
        .innerJoin(users, eq(users.id, friendships.user2Id))
        .leftJoin(userPhotos, and(
          eq(userPhotos.userId, users.id),
          eq(userPhotos.isPrimary, true)
        ))
        .where(eq(friendships.user1Id, userId));

      // Get friendships where user is user2
      const friendships2 = await db
        .select({
          id: friendships.id,
          user1Id: friendships.user1Id,
          user2Id: friendships.user2Id,
          createdAt: friendships.createdAt,
          friend: users,
          photo: userPhotos
        })
        .from(friendships)
        .innerJoin(users, eq(users.id, friendships.user1Id))
        .leftJoin(userPhotos, and(
          eq(userPhotos.userId, users.id),
          eq(userPhotos.isPrimary, true)
        ))
        .where(eq(friendships.user2Id, userId));

      // Combine and format results
      const allFriendships = [...friendships1, ...friendships2];

      return allFriendships.map(f => ({
        id: f.id,
        user1Id: f.user1Id,
        user2Id: f.user2Id,
        createdAt: f.createdAt,
        friend: {
          ...f.friend,
          primaryPhoto: f.photo ? {
            id: f.photo.id,
            photoUrl: f.photo.photoUrl,
            fileName: f.photo.fileName,
            isPrimary: f.photo.isPrimary || false
          } : null
        }
      })) as FriendshipWithUser[];
    });
  }

  async removeFriend(userId: string, friendId: string): Promise<boolean> {
    const result = await this.retryDatabaseOperation(async () => {
      return await db.delete(friendships)
        .where(or(
          and(eq(friendships.user1Id, userId), eq(friendships.user2Id, friendId)),
          and(eq(friendships.user1Id, friendId), eq(friendships.user2Id, userId))
        ));
    });

    return (result.rowCount ?? 0) > 0;
  }

  async getFriendshipStatus(userId: string, otherUserId: string): Promise<UserWithFriendStatus['friendshipStatus']> {
    // Check if they're friends
    const friendship = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendships)
        .where(or(
          and(eq(friendships.user1Id, userId), eq(friendships.user2Id, otherUserId)),
          and(eq(friendships.user1Id, otherUserId), eq(friendships.user2Id, userId))
        ));
    });

    if (friendship.length > 0) {
      return 'friends';
    }

    // Check for pending friend requests
    const sentRequest = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendRequests)
        .where(and(
          eq(friendRequests.senderId, userId),
          eq(friendRequests.receiverId, otherUserId),
          eq(friendRequests.status, 'pending')
        ));
    });

    if (sentRequest.length > 0) {
      return 'pending_sent';
    }

    const receivedRequest = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendRequests)
        .where(and(
          eq(friendRequests.senderId, otherUserId),
          eq(friendRequests.receiverId, userId),
          eq(friendRequests.status, 'pending')
        ));
    });

    if (receivedRequest.length > 0) {
      return 'pending_received';
    }

    return 'none';
  }

  async getUserWithFriendStatus(userId: string, currentUserId: string): Promise<UserWithFriendStatus | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;

    const friendshipStatus = await this.getFriendshipStatus(currentUserId, userId);

    return {
      ...user,
      friendshipStatus
    } as UserWithFriendStatus;
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.retryDatabaseOperation(async () => {
      return await db.select().from(friendships)
        .where(or(
          and(eq(friendships.user1Id, userId1), eq(friendships.user2Id, userId2)),
          and(eq(friendships.user1Id, userId2), eq(friendships.user2Id, userId1))
        ));
    });

    return friendship.length > 0;
  }

  // Privacy settings methods
  async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    const [settings] = await this.retryDatabaseOperation(async () => {
      return await db.select().from(userPrivacySettings)
        .where(eq(userPrivacySettings.userId, userId));
    });

    if (!settings) {
      // Create default privacy settings
      const [newSettings] = await this.retryDatabaseOperation(async () => {
        return await db.insert(userPrivacySettings)
          .values({ userId })
          .returning();
      });
      return newSettings;
    }

    return settings;
  }

  async updateUserPrivacySettings(userId: string, settings: UpdatePrivacySettings): Promise<UserPrivacySettings> {
    // Ensure user has privacy settings record
    await this.getUserPrivacySettings(userId);

    const [updated] = await this.retryDatabaseOperation(async () => {
      return await db.update(userPrivacySettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(userPrivacySettings.userId, userId))
        .returning();
    });

    return updated;
  }

  async canViewProfile(viewerId: string, targetUserId: string): Promise<boolean> {
    if (viewerId === targetUserId) return true;

    const privacy = await this.getUserPrivacySettings(targetUserId);

    switch (privacy.profileVisibility) {
      case 'public':
        return true;
      case 'friends':
        return await this.areFriends(viewerId, targetUserId);
      case 'private':
        return false;
      default:
        return true;
    }
  }

  async canSendDirectMessage(senderId: string, receiverId: string): Promise<boolean> {
    if (senderId === receiverId) return false;

    // Check if receiver has blocked sender
    const isBlocked = await this.isUserBlocked(receiverId, senderId);
    if (isBlocked) return false;

    const privacy = await this.getUserPrivacySettings(receiverId);

    switch (privacy.allowDirectMessages) {
      case 'everyone':
        return true;
      case 'friends':
        return await this.areFriends(senderId, receiverId);
      case 'nobody':
        return false;
      default:
        return true;
    }
  }

  // GDPR compliance methods
  async exportUserData(userId: string): Promise<any> {
    try {
      console.log(`[GDPR] Exporting data for user ${userId}`);

      // Get user basic info
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user photos
      const photos = await this.getUserPhotos(userId);

      // Get user messages (limit to last 1000 for reasonable size)
      const userMessagesQuery = await db
        .select({
          id: messages.id,
          content: messages.content,
          messageType: messages.messageType,
          createdAt: messages.createdAt,
          roomName: rooms.name,
          isPrivate: rooms.isPrivate
        })
        .from(messages)
        .leftJoin(rooms, eq(messages.roomId, rooms.id))
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.sequenceId))
        .limit(1000);

      // Get blocked users
      const blockedUsers = await this.getBlockedUsers(userId);

      // Get user rooms
      const userRooms = await this.getUserRooms(userId);

      // Get notification settings
      const notificationSettings = await this.getUserNotificationSettings(userId);

      // Get recent reports made by user
      const userReportsQuery = await db
        .select({
          id: reports.id,
          reason: reports.reason,
          description: reports.description,
          status: reports.status,
          reportedAt: reports.reportedAt
        })
        .from(reports)
        .where(eq(reports.reporterId, userId))
        .orderBy(desc(reports.reportedAt))
        .limit(100);

      // Compile all data
      const exportData = {
        exportInfo: {
          userId: userId,
          exportDate: new Date().toISOString(),
          dataType: 'GDPR_USER_DATA_EXPORT',
          version: '1.0'
        },
        personalInfo: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          age: user.age,
          location: user.location,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        },
        photos: photos.map(photo => ({
          id: photo.id,
          fileName: photo.fileName,
          photoUrl: photo.photoUrl,
          isPrimary: photo.isPrimary,
          uploadedAt: photo.uploadedAt
        })),
        messages: userMessagesQuery.map(msg => ({
          id: msg.id,
          content: msg.content,
          messageType: msg.messageType,
          sentAt: msg.createdAt,
          roomName: msg.roomName,
          isPrivateRoom: msg.isPrivate
        })),
        blockedUsers: blockedUsers.map(blocked => ({
          username: blocked.blockedUser.username,
          displayName: blocked.blockedUser.displayName,
          blockedAt: blocked.blockedAt
        })),
        joinedRooms: userRooms.map(room => ({
          id: room.id,
          name: room.name,
          description: room.description,
          isPrivate: room.isPrivate
        })),
        notificationSettings: notificationSettings,
        reportsSubmitted: userReportsQuery.map(report => ({
          id: report.id,
          reason: report.reason,
          description: report.description,
          status: report.status,
          submittedAt: report.reportedAt
        })),
        gdprInfo: {
          dataController: 'Chat Application',
          rightsInfo: 'You have the right to access, rectify, delete, or restrict processing of your personal data.',
          contactInfo: 'For privacy concerns, contact our data protection officer.',
          retentionPolicy: 'Personal data is retained as long as your account is active or as needed to provide services.',
          legalBasis: 'Processing is based on legitimate interests and user consent.'
        }
      };

      console.log(`[GDPR] Successfully exported ${Object.keys(exportData).length} data categories for user ${userId}`);
      return exportData;

    } catch (error) {
      console.error(`[GDPR] Error exporting data for user ${userId}:`, error);
      throw error;
    }
  }

  // Notification methods
  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettings> {
    try {
      const [settings] = await db
        .select()
        .from(userNotificationSettings)
        .where(eq(userNotificationSettings.userId, userId));

      if (settings) {
        return settings;
      }

      // Create default settings if they don't exist
      const defaultSettings = {
        userId,
        enableNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        newMessages: true,
        mentions: true,
        reactions: true,
        friendRequests: true,
        photoLikes: true,
        profileViews: false,
        newMatches: true,
        roomInvites: true,
        systemUpdates: true,
        securityAlerts: true,
      };

      const [newSettings] = await db
        .insert(userNotificationSettings)
        .values(defaultSettings)
        .returning();

      return newSettings;
    } catch (error) {
      console.error('Error getting user notification settings:', error);
      throw error;
    }
  }

  async updateUserNotificationSettings(userId: string, settings: UpdateNotificationSettings): Promise<UserNotificationSettings> {
    try {
      // First ensure settings exist
      await this.getUserNotificationSettings(userId);

      const [updatedSettings] = await db
        .update(userNotificationSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userNotificationSettings.userId, userId))
        .returning();

      return updatedSettings;
    } catch (error) {
      console.error('Error updating user notification settings:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<Notification[]> {
    try {
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return userNotifications;
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    try {
      const [notification] = await db
        .insert(notifications)
        .values({ ...notificationData, id: randomUUID() })
        .returning();

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // GDPR-compliant account deletion
  async deleteUserAccount(userId: string): Promise<{ success: boolean; deletedData: any }> {
    console.log(`[DB] Starting GDPR-compliant account deletion for user: ${userId}`);

    const deletedData: any = {
      user: null,
      messages: 0,
      reactions: 0,
      photos: 0,
      roomMemberships: 0,
      blockedUsers: 0,
      reports: 0,
      moderationActions: 0,
      notifications: 0,
      notificationSettings: 0,
      friendRequests: 0,
      friendships: 0,
      privacySettings: 0,
      createdRooms: 0
    };

    try {
      // First, get user data for audit log
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      deletedData.user = { id: user.id, username: user.username, displayName: user.displayName };

      // Protect the administrator user from deletion
      if (user.role === 'admin' && user.username === 'administrator') {
        throw new Error('Cannot delete the administrator account. This account is protected.');
      }

      console.log(`[DB] Deleting all data for user: ${user.username} (${userId})`);

      // 1. Delete user photos (also need to delete from object storage)
      console.log(`[DB] Deleting user photos...`);
      const userPhotosToDelete = await this.getUserPhotos(userId);
      deletedData.photos = userPhotosToDelete.length;
      if (userPhotosToDelete.length > 0) {
        await this.retryDatabaseOperation(async () => {
          await db.delete(userPhotos).where(eq(userPhotos.userId, userId));
        });
      }


      // 3. Anonymize user's messages instead of deleting them to preserve chat history
      // Replace user content with "[deleted user]" to maintain conversation flow
      console.log(`[DB] Anonymizing user messages...`);
      const messagesResult = await this.retryDatabaseOperation(async () => {
        return await db.update(messages)
          .set({
            content: '[Message from deleted user]',
            photoUrl: null,
            photoFileName: null,
            mentionedUserIds: [],
            userId: 'deleted-user' // CRITICAL: Replace with placeholder to allow user deletion
          })
          .where(eq(messages.userId, userId));
      });
      deletedData.messages = messagesResult.rowCount || 0;

      // 4. Remove user from all room memberships
      console.log(`[DB] Removing room memberships...`);
      const roomMembershipsResult = await this.retryDatabaseOperation(async () => {
        return await db.delete(roomMembers).where(eq(roomMembers.userId, userId));
      });
      deletedData.roomMemberships = roomMembershipsResult.rowCount || 0;

      // 5. Delete blocking relationships (both ways - user blocking others and others blocking user)
      console.log(`[DB] Deleting blocking relationships...`);
      const blockedResult1 = await this.retryDatabaseOperation(async () => {
        return await db.delete(blockedUsers).where(eq(blockedUsers.blockerId, userId));
      });
      const blockedResult2 = await this.retryDatabaseOperation(async () => {
        return await db.delete(blockedUsers).where(eq(blockedUsers.blockedId, userId));
      });
      deletedData.blockedUsers = (blockedResult1.rowCount || 0) + (blockedResult2.rowCount || 0);

      // 6. Delete reports (both reports made by user and reports against user)
      console.log(`[DB] Deleting reports...`);
      const reportsResult1 = await this.retryDatabaseOperation(async () => {
        return await db.delete(reports).where(eq(reports.reporterId, userId));
      });
      const reportsResult2 = await this.retryDatabaseOperation(async () => {
        return await db.delete(reports).where(eq(reports.reportedUserId, userId));
      });
      deletedData.reports = (reportsResult1.rowCount || 0) + (reportsResult2.rowCount || 0);

      // 7. Delete moderation actions against the user
      console.log(`[DB] Deleting moderation actions...`);
      const moderationResult = await this.retryDatabaseOperation(async () => {
        return await db.delete(userModerationActions).where(eq(userModerationActions.userId, userId));
      });
      deletedData.moderationActions = moderationResult.rowCount || 0;

      // 8. Delete user notifications
      console.log(`[DB] Deleting notifications...`);
      const notificationsResult = await this.retryDatabaseOperation(async () => {
        return await db.delete(notifications).where(eq(notifications.userId, userId));
      });
      deletedData.notifications = notificationsResult.rowCount || 0;

      // 9. Delete user notification settings
      console.log(`[DB] Deleting notification settings...`);
      const notificationSettingsResult = await this.retryDatabaseOperation(async () => {
        return await db.delete(userNotificationSettings).where(eq(userNotificationSettings.userId, userId));
      });
      deletedData.notificationSettings = notificationSettingsResult.rowCount || 0;

      // 10. Delete friend requests (both sent and received)
      console.log(`[DB] Deleting friend requests...`);
      const friendRequestsResult1 = await this.retryDatabaseOperation(async () => {
        return await db.delete(friendRequests).where(eq(friendRequests.senderId, userId));
      });
      const friendRequestsResult2 = await this.retryDatabaseOperation(async () => {
        return await db.delete(friendRequests).where(eq(friendRequests.receiverId, userId));
      });
      deletedData.friendRequests = (friendRequestsResult1.rowCount || 0) + (friendRequestsResult2.rowCount || 0);

      // 11. Delete friendships (both as user1 and user2)
      console.log(`[DB] Deleting friendships...`);
      const friendshipsResult1 = await this.retryDatabaseOperation(async () => {
        return await db.delete(friendships).where(eq(friendships.user1Id, userId));
      });
      const friendshipsResult2 = await this.retryDatabaseOperation(async () => {
        return await db.delete(friendships).where(eq(friendships.user2Id, userId));
      });
      deletedData.friendships = (friendshipsResult1.rowCount || 0) + (friendshipsResult2.rowCount || 0);

      // 12. Delete user privacy settings
      console.log(`[DB] Deleting privacy settings...`);
      const privacySettingsResult = await this.retryDatabaseOperation(async () => {
        return await db.delete(userPrivacySettings).where(eq(userPrivacySettings.userId, userId));
      });
      deletedData.privacySettings = privacySettingsResult.rowCount || 0;

      // 13. Delete or transfer ownership of rooms created by the user
      console.log(`[DB] Handling rooms created by user...`);
      const createdRooms = await db.select().from(rooms).where(eq(rooms.createdBy, userId));
      deletedData.createdRooms = createdRooms.length;

      for (const room of createdRooms) {
        if (room.isPrivate) {
          // Delete private rooms entirely
          await this.retryDatabaseOperation(async () => {
            await db.delete(messages).where(eq(messages.roomId, room.id));
            await db.delete(roomMembers).where(eq(roomMembers.roomId, room.id));
            await db.delete(rooms).where(eq(rooms.id, room.id));
          });
        } else {
          // For public rooms, transfer ownership to admin or delete if it's user-created
          const adminUser = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
          if (adminUser.length > 0) {
            await this.retryDatabaseOperation(async () => {
              await db.update(rooms)
                .set({ createdBy: adminUser[0].id })
                .where(eq(rooms.id, room.id));
            });
          } else {
            // No admin found, delete the room
            await this.retryDatabaseOperation(async () => {
              await db.delete(messages).where(eq(messages.roomId, room.id));
              await db.delete(roomMembers).where(eq(roomMembers.roomId, room.id));
              await db.delete(rooms).where(eq(rooms.id, room.id));
            });
          }
        }
      }

      // 14. Finally, delete the user record itself
      console.log(`[DB] Deleting user record...`);
      await this.retryDatabaseOperation(async () => {
        await db.delete(users).where(eq(users.id, userId));
      });

      console.log(`[DB] GDPR-compliant account deletion completed successfully for user: ${userId}`);
      console.log(`[DB] Deletion summary:`, deletedData);

      return { success: true, deletedData };

    } catch (error) {
      console.error(`[DB] Error during account deletion for user ${userId}:`, error);
      throw error;
    }
  }

  // Helper method to calculate distance using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for calculating great-circle distance between two points
    const R = 6371; // Radius of Earth in kilometers

    // Convert degrees to radians
    const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    const deltaLatRad = toRadians(lat2 - lat1);
    const deltaLonRad = toRadians(lon2 - lon1);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Return rounded distance in kilometers
    return Math.round(distance);
  }

  // Admin methods
  async createFixedAdminUser(): Promise<void> {
    try {
      const { adminUsers } = await import('@shared/schema');
      const bcrypt = await import('bcryptjs');
      
      // Check if admin user already exists
      const [existingAdmin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, 'chatualadmin'));

      if (existingAdmin) {
        console.log('[ADMIN] Fixed admin user already exists');
        return;
      }

      // Create fixed admin user
      const hashedPassword = await bcrypt.hash('Hardcore123!', 10);
      
      await db
        .insert(adminUsers)
        .values({
          username: 'chatualadmin',
          password: hashedPassword,
        });

      console.log('[ADMIN] Fixed admin user created successfully');
    } catch (error) {
      console.error('Error creating fixed admin user:', error);
      throw error;
    }
  }

  async authenticateAdmin(credentials: { username: string; password: string }): Promise<any | null> {
    try {
      const { adminUsers } = await import('@shared/schema');
      const bcrypt = await import('bcryptjs');

      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.username, credentials.username));

      if (!admin || !admin.isActive) {
        return null;
      }

      const isValidPassword = await bcrypt.compare(credentials.password, admin.password);
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await db
        .update(adminUsers)
        .set({ lastLogin: new Date() })
        .where(eq(adminUsers.id, admin.id));

      // Return admin with role for RBAC
      return {
        id: admin.id,
        username: admin.username,
        role: admin.role as UserRole,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        lastLogin: new Date()
      };
    } catch (error) {
      console.error('Error authenticating admin:', error);
      throw error;
    }
  }

  async getAdminUser(id: string): Promise<any | null> {
    try {
      const { adminUsers } = await import('@shared/schema');
      
      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, id));

      return admin || null;
    } catch (error) {
      console.error('Error getting admin user:', error);
      throw error;
    }
  }

  // Admin user management methods
  async getBannedUsers(): Promise<User[]> {
    try {
      console.log('[DB] Fetching banned users');
      const bannedUsers = await db
        .select()
        .from(users)
        .where(and(
          eq(users.isBanned, true),
          ne(users.role, 'admin') // Exclude admin users
        ))
        .orderBy(desc(users.bannedAt));
      
      console.log(`[DB] Found ${bannedUsers.length} banned users`);
      return bannedUsers;
    } catch (error) {
      console.error('Error fetching banned users:', error);
      throw error;
    }
  }

  async getAllBlockedUsers(): Promise<any[]> {
    try {
      console.log('[DB] Fetching all blocked users');
      const blockedRelations = await db
        .select()
        .from(blockedUsers)
        .orderBy(desc(blockedUsers.blockedAt));
      
      console.log(`[DB] Found ${blockedRelations.length} blocked user relations`);
      return blockedRelations;
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      throw error;
    }
  }

  async getReportedUsers(): Promise<any[]> {
    try {
      console.log('[DB] Fetching reported users');
      const reportedUsersList = await db
        .select()
        .from(reports)
        .orderBy(desc(reports.reportedAt));
      
      console.log(`[DB] Found ${reportedUsersList.length} reported users`);
      return reportedUsersList;
    } catch (error) {
      console.error('Error fetching reported users:', error);
      throw error;
    }
  }

  async sendAdminMessage(adminId: string, userId: string, message: string, messageType: string = 'admin_notification'): Promise<any> {
    try {
      console.log(`[DB] Admin ${adminId} sending message to user ${userId}`);
      
      const messageData = {
        id: randomUUID(),
        content: message,
        messageType,
        userId: adminId, // From admin
        roomId: null, // Direct admin message
        photoUrl: null,
        photoFileName: null,
        mentionedUserIds: [userId], // To user
        isDeleted: false,
        createdAt: new Date(),
        sequenceId: Date.now()
      };

      // Note: This creates a notification instead of a direct message
      const notificationData = {
        id: randomUUID(),
        userId: userId,
        type: messageType,
        title: 'Admin Message',
        body: message,
        isRead: false,
        createdAt: new Date()
      };

      await db.insert(notifications).values([notificationData]);
      
      console.log(`[DB] Admin message sent successfully`);
      return messageData;
    } catch (error) {
      console.error('Error sending admin message:', error);
      throw error;
    }
  }

  // Enhanced moderation methods implementation
  async logModerationAction(action: InsertModerationAction): Promise<ModerationAction> {
    const { userModerationActions } = await import('@shared/schema');
    
    const [result] = await db
      .insert(userModerationActions)
      .values(action)
      .returning();
    
    console.log(`[MODERATION] Action logged: ${action.actionType} for user ${action.userId} by ${action.performedBy}`);
    return result;
  }

  async getModerationActions(pagination?: PaginationParams): Promise<PaginatedResponse<ModerationActionWithDetails>> {
    const { userModerationActions, users } = await import('@shared/schema');
    const { limit = 50, before, after } = pagination || {};
    
    const result = await db
      .select({
        action: userModerationActions,
        user: users,
        performedByUser: {
          id: userModerationActions.performedBy,
          username: users.username
        }
      })
      .from(userModerationActions)
      .innerJoin(users, eq(userModerationActions.userId, users.id))
      .orderBy(desc(userModerationActions.performedAt))
      .limit(limit + 1);

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, -1) : result;

    return {
      items: items.map(({ action, user, performedByUser }) => ({
        ...action,
        user,
        performedByUser
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.action.id : undefined
    };
  }

  async getModerationActionsByUser(userId: string): Promise<ModerationActionWithDetails[]> {
    const { userModerationActions, users } = await import('@shared/schema');
    
    const result = await db
      .select({
        action: userModerationActions,
        user: users,
        performedByUser: {
          id: userModerationActions.performedBy,
          username: users.username
        }
      })
      .from(userModerationActions)
      .innerJoin(users, eq(userModerationActions.userId, users.id))
      .where(eq(userModerationActions.userId, userId))
      .orderBy(desc(userModerationActions.performedAt));

    return result.map(({ action, user, performedByUser }) => ({
      ...action,
      user,
      performedByUser
    }));
  }

  async getModerationActionsByAdmin(adminId: string): Promise<ModerationActionWithDetails[]> {
    const { userModerationActions, users } = await import('@shared/schema');
    
    const result = await db
      .select({
        action: userModerationActions,
        user: users,
        performedByUser: {
          id: userModerationActions.performedBy,
          username: users.username
        }
      })
      .from(userModerationActions)
      .innerJoin(users, eq(userModerationActions.userId, users.id))
      .where(eq(userModerationActions.performedBy, adminId))
      .orderBy(desc(userModerationActions.performedAt));

    return result.map(({ action, user, performedByUser }) => ({
      ...action,
      user,
      performedByUser
    }));
  }

  async getUserBehaviorScore(userId: string): Promise<UserBehaviorScore | undefined> {
    const { userBehaviorScores } = await import('@shared/schema');
    
    const [result] = await db
      .select()
      .from(userBehaviorScores)
      .where(eq(userBehaviorScores.userId, userId));

    return result;
  }

  async updateUserBehaviorScore(userId: string, updates: Partial<InsertUserBehaviorScore>): Promise<UserBehaviorScore> {
    const { userBehaviorScores } = await import('@shared/schema');
    
    const existingScore = await this.getUserBehaviorScore(userId);
    
    if (existingScore) {
      const [result] = await db
        .update(userBehaviorScores)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userBehaviorScores.userId, userId))
        .returning();
      return result;
    } else {
      const [result] = await db
        .insert(userBehaviorScores)
        .values({ userId, ...updates })
        .returning();
      return result;
    }
  }

  async escalateUserWarning(warning: WarningEscalation): Promise<{ action: ModerationAction; escalated: boolean; nextLevel: number }> {
    const { userId, reason, severity, autoEscalate } = warning;
    
    const behaviorScore = await this.getUserBehaviorScore(userId);
    const currentLevel = behaviorScore?.nextEscalationLevel || 1;
    
    // Log the warning action
    const action = await this.logModerationAction({
      userId,
      actionType: 'warning',
      reason,
      severity: severity || currentLevel,
      performedBy: 'system', // Auto-escalation system
      notes: `Warning level ${currentLevel}${autoEscalate ? ' (auto-escalated)' : ''}`
    });

    // Update behavior score
    const newWarningCount = (behaviorScore?.warningCount || 0) + 1;
    const newViolationCount = (behaviorScore?.violationCount || 0) + 1;
    const newBehaviorScore = Math.max(0, (behaviorScore?.behaviorScore || 100) - (severity || currentLevel) * 10);
    const nextLevel = Math.min(5, currentLevel + 1);

    await this.updateUserBehaviorScore(userId, {
      warningCount: newWarningCount,
      violationCount: newViolationCount,
      behaviorScore: newBehaviorScore,
      lastWarningAt: new Date(),
      nextEscalationLevel: nextLevel
    });

    // Auto-escalate to ban if needed
    let escalated = false;
    if (autoEscalate && (newWarningCount >= 5 || newBehaviorScore <= 20)) {
      await this.banUser({
        userId,
        reason: `Auto-escalation: ${newWarningCount} warnings, behavior score: ${newBehaviorScore}`,
        performedBy: 'system'
      });
      escalated = true;
    }

    return { action, escalated, nextLevel };
  }

  async getUsersWithBehaviorScores(pagination?: PaginationParams): Promise<PaginatedResponse<UserWithBehaviorScore>> {
    const { users, userBehaviorScores } = await import('@shared/schema');
    const { limit = 50 } = pagination || {};
    
    const result = await db
      .select({
        user: users,
        behaviorScore: userBehaviorScores
      })
      .from(users)
      .leftJoin(userBehaviorScores, eq(users.id, userBehaviorScores.userId))
      .orderBy(desc(userBehaviorScores.behaviorScore))
      .limit(limit + 1);

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, -1) : result;

    return {
      items: items.map(({ user, behaviorScore }) => ({
        ...user,
        behaviorScore,
        warningCount: behaviorScore?.warningCount || 0,
        violationCount: behaviorScore?.violationCount || 0
      })),
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.user.id : undefined
    };
  }

  async calculateBehaviorScore(userId: string): Promise<number> {
    const { userModerationActions } = await import('@shared/schema');
    
    const actions = await db
      .select()
      .from(userModerationActions)
      .where(eq(userModerationActions.userId, userId))
      .orderBy(desc(userModerationActions.performedAt));

    let score = 100;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const action of actions) {
      if (action.performedAt && action.performedAt > thirtyDaysAgo) {
        const severity = action.severity || 1;
        switch (action.actionType) {
          case 'warning':
            score -= severity * 5;
            break;
          case 'ban':
            score -= severity * 20;
            break;
          case 'block':
            score -= severity * 10;
            break;
        }
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const { systemConfig } = await import('@shared/schema');
    
    const [result] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.configKey, key));

    return result;
  }

  async setSystemConfig(config: InsertSystemConfig): Promise<SystemConfig> {
    const { systemConfig } = await import('@shared/schema');
    
    const [result] = await db
      .insert(systemConfig)
      .values(config)
      .returning();

    return result;
  }

  async updateSystemConfig(updates: SystemConfigUpdate): Promise<SystemConfig> {
    const { systemConfig } = await import('@shared/schema');
    
    const [result] = await db
      .update(systemConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemConfig.configKey, updates.configKey))
      .returning();

    return result;
  }

  async getAllSystemConfigs(): Promise<SystemConfig[]> {
    const { systemConfig } = await import('@shared/schema');
    
    return await db
      .select()
      .from(systemConfig)
      .orderBy(systemConfig.configKey);
  }

  async bulkUserAction(action: BulkUserAction, adminId: string): Promise<{ 
    success: number; 
    failed: number; 
    actions: ModerationAction[];
    errors: string[];
  }> {
    const { userIds, actionType, reason, notes, severity } = action;
    let success = 0;
    let failed = 0;
    const actions: ModerationAction[] = [];
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        let moderationAction: ModerationAction;
        
        switch (actionType) {
          case 'ban':
            await this.banUser({ userId, reason, performedBy: adminId });
            moderationAction = await this.logModerationAction({
              userId,
              actionType: 'bulk_action',
              reason: `Bulk ban: ${reason}`,
              notes: notes || 'Bulk operation',
              performedBy: adminId,
              severity,
              affectedUsers: [userId]
            });
            break;
            
          case 'unban':
            await this.unbanUser(userId, adminId);
            moderationAction = await this.logModerationAction({
              userId,
              actionType: 'bulk_action',
              reason: `Bulk unban: ${reason}`,
              notes: notes || 'Bulk operation',
              performedBy: adminId,
              affectedUsers: [userId]
            });
            break;
            
          case 'block':
            await this.blockUser(adminId, userId, reason);
            moderationAction = await this.logModerationAction({
              userId,
              actionType: 'bulk_action',
              reason: `Bulk block: ${reason}`,
              notes: notes || 'Bulk operation',
              performedBy: adminId,
              affectedUsers: [userId]
            });
            break;
            
          case 'warn':
            const escalation = await this.escalateUserWarning({
              userId,
              reason: `Bulk warning: ${reason}`,
              severity: severity || 1,
              autoEscalate: false
            });
            moderationAction = escalation.action;
            break;
            
          default:
            throw new Error(`Unsupported bulk action: ${actionType}`);
        }
        
        actions.push(moderationAction);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to ${actionType} user ${userId}: ${error.message}`);
      }
    }

    console.log(`[BULK_MODERATION] ${actionType} completed: ${success} success, ${failed} failed`);
    return { success, failed, actions, errors };
  }

  async getBannedUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.isBanned, true))
      .orderBy(desc(users.bannedAt));
  }

  async getAllBlockedUsers(): Promise<User[]> {
    const { blockedUsers } = await import('@shared/schema');
    
    const result = await db
      .select({
        user: users
      })
      .from(blockedUsers)
      .innerJoin(users, eq(blockedUsers.blockedId, users.id))
      .orderBy(desc(blockedUsers.blockedAt));

    return result.map(({ user }) => user);
  }

  async getCleanupConfiguration(): Promise<{ 
    messageRetentionDays: number; 
    messagesPerRoom: number; 
    autoCleanup: boolean;
    lastCleanup: Date | null;
  }> {
    const retentionConfig = await this.getSystemConfig('message_retention_days');
    const perRoomConfig = await this.getSystemConfig('messages_per_room');
    const autoCleanupConfig = await this.getSystemConfig('auto_cleanup');
    const lastCleanupConfig = await this.getSystemConfig('last_cleanup');

    return {
      messageRetentionDays: retentionConfig?.configValue as number || 30,
      messagesPerRoom: perRoomConfig?.configValue as number || 40,
      autoCleanup: autoCleanupConfig?.configValue as boolean || true,
      lastCleanup: lastCleanupConfig?.configValue ? new Date(lastCleanupConfig.configValue as string) : null
    };
  }

  async setCleanupConfiguration(config: { 
    messageRetentionDays?: number; 
    messagesPerRoom?: number; 
    autoCleanup?: boolean;
  }): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        const configKey = key === 'messagesPerRoom' ? 'messages_per_room' : 
                         key === 'messageRetentionDays' ? 'message_retention_days' :
                         key === 'autoCleanup' ? 'auto_cleanup' : key;
        
        const existing = await this.getSystemConfig(configKey);
        if (existing) {
          await this.updateSystemConfig({
            configKey,
            configValue: value,
            description: `Cleanup configuration: ${key}`
          });
        } else {
          await this.setSystemConfig({
            configKey,
            configValue: value,
            description: `Cleanup configuration: ${key}`
          });
        }
      }
    }
  }

  async performConfiguredCleanup(): Promise<{ 
    messagesDeleted: number; 
    roomsCleaned: number;
    oldestMessage: Date | null;
    cleanupDuration: number;
  }> {
    const startTime = Date.now();
    const config = await this.getCleanupConfiguration();
    
    console.log(`[CONFIGURED_CLEANUP] Starting with config: ${JSON.stringify(config)}`);
    
    // Perform cleanup based on configuration
    const result = await this.cleanupOldMessages(config.messagesPerRoom);
    
    // Update last cleanup timestamp
    await this.setCleanupConfiguration({ });
    await this.updateSystemConfig({
      configKey: 'last_cleanup',
      configValue: new Date().toISOString(),
      description: 'Last cleanup timestamp'
    });

    // Log the cleanup action
    await this.logModerationAction({
      userId: 'system',
      actionType: 'bulk_action',
      reason: 'Automated message cleanup',
      notes: `Deleted ${result.totalDeleted} messages from ${result.roomsCleaned} rooms`,
      performedBy: 'system',
      metadata: { 
        messagesDeleted: result.totalDeleted,
        roomsCleaned: result.roomsCleaned,
        duration: Date.now() - startTime
      }
    });

    const duration = Date.now() - startTime;
    
    return {
      messagesDeleted: result.totalDeleted,
      roomsCleaned: result.roomsCleaned,
      oldestMessage: null, // Could be enhanced to track oldest remaining message
      cleanupDuration: duration
    };
  }

  async getSystemModerationStats(): Promise<SystemModerationStats> {
    const { userModerationActions, userBehaviorScores } = await import('@shared/schema');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Count total actions
    const [totalActionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModerationActions);
    
    // Get recent actions
    const recentActions = await this.getModerationActions({ limit: 10 });
    
    // Count warning escalations in last 30 days
    const [warningEscalationsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModerationActions)
      .where(
        and(
          eq(userModerationActions.actionType, 'warning'),
          gte(userModerationActions.performedAt, thirtyDaysAgo)
        )
      );

    // Calculate average behavior score
    const [avgBehaviorScoreResult] = await db
      .select({ avg: sql<number>`avg(${userBehaviorScores.behaviorScore})` })
      .from(userBehaviorScores);

    // Count auto-moderation events
    const [autoModerationResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModerationActions)
      .where(eq(userModerationActions.performedBy, 'system'));

    // Count cleanup operations
    const [cleanupOperationsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userModerationActions)
      .where(
        and(
          eq(userModerationActions.actionType, 'bulk_action'),
          ilike(userModerationActions.reason, '%cleanup%')
        )
      );

    return {
      totalActions: totalActionsResult.count || 0,
      recentActions: recentActions.items,
      warningEscalations: warningEscalationsResult.count || 0,
      behaviorScoreAverage: Math.round(avgBehaviorScoreResult.avg || 100),
      autoModerationEvents: autoModerationResult.count || 0,
      cleanupOperations: cleanupOperationsResult.count || 0
    };
  }
}