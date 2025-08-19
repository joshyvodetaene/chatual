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
  type CreateReport,
  type UpdateReportStatus,
  type ReportWithDetails,
  type ModerationData,
  type PaginationParams,
  type PaginatedResponse,
  type MessageReaction,
  type InsertMessageReaction,
  type ReactionSummary
} from "@shared/schema";
import { DatabaseStorage } from "./database-storage";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  registerUser(user: RegisterUser): Promise<User>;
  authenticateUser(credentials: LoginUser): Promise<User | null>;
  isUsernameAvailable(username: string): Promise<boolean>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  getOnlineUsers(): Promise<User[]>;
  getUsersWithDistance(currentUserId: string): Promise<UserWithDistance[]>;

  // Room methods
  createRoom(room: InsertRoom): Promise<Room>;
  getRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomWithMembers(id: string): Promise<RoomWithMembers | undefined>;
  deleteRoom(roomId: string, adminUserId: string): Promise<boolean>;

  // Room member methods
  addRoomMember(roomMember: InsertRoomMember): Promise<RoomMember>;
  removeRoomMember(roomId: string, userId: string): Promise<void>;
  getRoomMembers(roomId: string): Promise<User[]>;
  getUserRooms(userId: string): Promise<Room[]>;
  isUserInRoom(roomId: string, userId: string): Promise<boolean>;

  // Private room methods
  createPrivateRoom(user1Id: string, user2Id: string): Promise<Room>;
  getPrivateRoom(user1Id: string, user2Id: string): Promise<Room | undefined>;
  getPrivateRooms(userId: string): Promise<PrivateRoom[]>;
  deletePrivateRoom(roomId: string, userId: string): Promise<boolean>;
  getRoomsAndPrivateRooms(userId: string): Promise<PrivateChatData>;

  // Search methods
  searchMessages(query: string, roomId?: string, userId?: string, limit?: number): Promise<MessageWithUser[]>;
  searchUsers(query: string, currentUserId?: string, limit?: number): Promise<User[]>;
  searchRooms(query: string, userId?: string, limit?: number): Promise<Room[]>;

  // Reaction methods
  addReaction(reactionData: InsertMessageReaction): Promise<MessageReaction>;
  removeReaction(messageId: string, userId: string, emoji: string): Promise<boolean>;
  getMessageReactions(messageId: string, currentUserId?: string): Promise<ReactionSummary[]>;

  // Message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getRoomMessages(roomId: string, pagination?: PaginationParams): Promise<PaginatedResponse<MessageWithUser>>;

  // Photo methods
  addUserPhoto(photoData: InsertUserPhoto): Promise<UserPhoto>;
  getUserPhotos(userId: string): Promise<UserPhoto[]>;
  getUserWithPhotos(userId: string): Promise<UserWithPhotos | undefined>;
  deleteUserPhoto(photoId: string, userId: string): Promise<void>;
  setPrimaryPhoto(photoId: string, userId: string): Promise<void>;

  // Profile settings methods
  updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User>;
  getUserProfileSettings(userId: string): Promise<UserProfileSettings>;
  
  // Blocked users methods
  blockUser(blockData: InsertBlockedUser): Promise<BlockedUser>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<BlockedUserWithDetails[]>;
  isUserBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockedByUsers(userId: string): Promise<string[]>; // Get users who have blocked this user
  
  // Reporting methods
  createReport(reportData: InsertReport): Promise<Report>;
  getReports(adminUserId: string): Promise<ReportWithDetails[]>; // Admin only
  getReportById(reportId: string): Promise<ReportWithDetails | undefined>;
  updateReportStatus(reportId: string, statusUpdate: UpdateReportStatus, adminUserId: string): Promise<Report>;
  getUserReports(reportedUserId: string): Promise<ReportWithDetails[]>; // Get reports about a specific user
  getModerationData(adminUserId: string): Promise<ModerationData>; // Get summary for admin panel
}

export const storage = new DatabaseStorage();
