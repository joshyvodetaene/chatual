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
  userModerationActions
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, ne, sql, gt, lt } from "drizzle-orm";
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
        const currentUser = await this.getUser(userId);
        if (otherUser && currentUser) {
          privateRoomsWithOtherUser.push({
            id: room.id,
            participant1Id: userId,
            participant2Id: otherUserId,
            participant1: currentUser,
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

  async getRoomMessages(roomId: string, pagination: PaginationParams = {}): Promise<PaginatedResponse<MessageWithUser>> {
    const { limit = 50, before, after } = pagination;
    
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
      primaryPhoto: primaryPhoto ? {
        ...primaryPhoto,
        isPrimary: primaryPhoto.isPrimary || false
      } : primaryPhoto
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

  async getBlockedByUsers(userId: string): Promise<string[]> {
    const blockers = await db
      .select({ blockerId: blockedUsers.blockerId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockedId, userId));
    
    return blockers.map(b => b.blockerId);
  }

  // Reporting methods
  async createReport(reportData: InsertReport): Promise<Report> {
    const [report] = await db.insert(reports).values({ ...reportData, id: randomUUID() }).returning();
    return report;
  }

  async getReports(adminUserId: string): Promise<ReportWithDetails[]> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    const reportedUserAlias = {
      id: users.id,
      username: users.username,
      displayName: users.displayName
    };
    
    const reportsList = await db
      .select({
        report: reports,
        reporter: users,
        reportedUser: reportedUserAlias
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .innerJoin(users, eq(reports.reportedUserId, users.id))
      .orderBy(desc(reports.reportedAt));

    return reportsList.map(({ report, reporter, reportedUser }) => ({
      ...report,
      reporter,
      reportedUser: reportedUser as User,
      reviewedByUser: report.reviewedBy ? undefined : undefined // Will be populated separately if needed
    }));
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

    const [updatedReport] = await db
      .update(reports)
      .set({
        status: statusUpdate.status,
        adminNotes: statusUpdate.adminNotes,
        reviewedBy: adminUserId,
        reviewedAt: new Date()
      })
      .where(eq(reports.id, reportId))
      .returning();

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

    const [action] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();
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
    const [bannedUser] = await db
      .update(users)
      .set({
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: adminUserId,
        banReason: banData.reason
      })
      .where(eq(users.id, banData.userId))
      .returning();

    // Create moderation action record
    const moderationAction: InsertModerationAction = {
      userId: banData.userId,
      actionType: 'ban',
      reason: banData.reason,
      notes: banData.notes,
      performedBy: adminUserId,
      expiresAt
    };

    const [action] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();

    return { user: bannedUser, action };
  }

  async unbanUser(userId: string, adminUserId: string, reason: string): Promise<{ user: User; action: UserModerationAction }> {
    // Check if user is admin
    const admin = await this.getUser(adminUserId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    // Update user ban status
    const [unbannedUser] = await db
      .update(users)
      .set({
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
        banReason: null
      })
      .where(eq(users.id, userId))
      .returning();

    // Create moderation action record
    const moderationAction: InsertModerationAction = {
      userId,
      actionType: 'unban',
      reason,
      notes: 'User unbanned by admin',
      performedBy: adminUserId,
    };

    const [action] = await db.insert(userModerationActions).values({ ...moderationAction, id: randomUUID() }).returning();

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
}