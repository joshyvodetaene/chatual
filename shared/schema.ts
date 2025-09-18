import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  displayName: varchar("display_name"),
  password: varchar("password").notNull(),
  age: integer("age").notNull(),
  gender: varchar("gender").notNull(),
  location: varchar("location").notNull(),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  genderPreference: varchar("gender_preference").notNull().default("all"), // "male", "female", "all"
  ageMin: integer("age_min").default(18),
  ageMax: integer("age_max").default(99),
  role: varchar("role").notNull().default("user"),
  avatar: varchar("avatar"),
  bio: text("bio"),
  dateOfBirth: varchar("date_of_birth"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  isBanned: boolean("is_banned").default(false),
  bannedAt: timestamp("banned_at"),
  bannedBy: varchar("banned_by"),
  banReason: text("ban_reason"),
});

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  isPrivate: boolean("is_private").default(false),
  memberIds: varchar("member_ids").array(), // Array of user IDs
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: integer("sequence_id").notNull(),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  roomId: varchar("room_id").notNull().references(() => rooms.id),
  createdAt: timestamp("created_at").defaultNow(),
  photoUrl: varchar("photo_url"),
  photoFileName: varchar("photo_file_name"),
  messageType: varchar("message_type").notNull().default("text"), // "text", "photo"
  mentionedUserIds: varchar("mentioned_user_ids").array(), // Array of mentioned user IDs
});

// User profile photos table
export const userPhotos = pgTable("user_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  photoUrl: varchar("photo_url").notNull(),
  fileName: varchar("file_name").notNull(),
  isPrimary: boolean("is_primary").default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const roomMembers = pgTable("room_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => rooms.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Blocked users table
export const blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id),
  blockedId: varchar("blocked_id").notNull().references(() => users.id),
  blockedAt: timestamp("blocked_at").defaultNow(),
  reason: text("reason"), // Optional reason for blocking
  expiresAt: timestamp("expires_at"), // For scheduled blocks
  roomId: varchar("room_id").references(() => rooms.id), // For room-specific blocks
});

// User warnings/bans tracking table
export const userModerationActions = pgTable("user_moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionType: varchar("action_type", { 
    enum: ["warning", "ban", "unban", "block", "unblock", "delete", "message", "bulk_action"] 
  }).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  performedBy: varchar("performed_by").notNull().references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // For temporary bans
  severity: integer("severity").default(1), // 1-5 for warning escalation
  affectedUsers: varchar("affected_users").array(), // For bulk operations
  metadata: jsonb("metadata"), // Additional action data
});

// Reports table for user reporting system
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id),
  reason: varchar("reason", { enum: ["harassment", "spam", "inappropriate_content", "fake_profile", "other"] }).notNull(),
  description: text("description"), // Detailed description of the report
  status: varchar("status", { enum: ["pending", "reviewed", "resolved", "dismissed"] }).notNull().default("pending"),
  reportedAt: timestamp("reported_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin who reviewed the report
  adminNotes: text("admin_notes"), // Admin notes for the report
});

// User notification settings table
export const userNotificationSettings = pgTable('user_notification_settings', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  enableNotifications: boolean('enable_notifications').default(true).notNull(),
  soundEnabled: boolean('sound_enabled').default(true).notNull(),
  vibrationEnabled: boolean('vibration_enabled').default(true).notNull(),
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false).notNull(),
  quietHoursStart: varchar('quiet_hours_start').default('22:00'),
  quietHoursEnd: varchar('quiet_hours_end').default('08:00'),
  newMessages: boolean('new_messages').default(true).notNull(),
  mentions: boolean('mentions').default(true).notNull(),
  reactions: boolean('reactions').default(true).notNull(),
  friendRequests: boolean('friend_requests').default(true).notNull(),
  photoLikes: boolean('photo_likes').default(true).notNull(),
  profileViews: boolean('profile_views').default(false).notNull(),
  newMatches: boolean('new_matches').default(true).notNull(),
  roomInvites: boolean('room_invites').default(true).notNull(),
  systemUpdates: boolean('system_updates').default(true).notNull(),
  securityAlerts: boolean('security_alerts').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notifications table for storing user notifications
export const notifications = pgTable('notifications', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type').notNull(), // 'message' | 'mention' | 'reaction' | 'friend_request' | etc
  title: varchar('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'), // Additional data like user IDs, message IDs, etc
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Friend requests table
export const friendRequests = pgTable("friend_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar("status").notNull().default("pending"), // "pending", "accepted", "declined"
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Friendships table
export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  user2Id: varchar("user2_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

// User privacy settings table
export const userPrivacySettings = pgTable("user_privacy_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  profileVisibility: varchar("profile_visibility").notNull().default("public"), // "public", "friends", "private"
  showOnlineStatus: boolean("show_online_status").default(true).notNull(),
  showLastSeen: boolean("show_last_seen").default(true).notNull(),
  showAge: boolean("show_age").default(true).notNull(),
  showLocation: boolean("show_location").default(true).notNull(),
  allowDirectMessages: varchar("allow_direct_messages").notNull().default("everyone"), // "everyone", "friends", "nobody"
  showPhotosToStrangers: boolean("show_photos_to_strangers").default(true).notNull(),
  discoverableInSearch: boolean("discoverable_in_search").default(true).notNull(),
  allowMentions: boolean("allow_mentions").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin user table for system administration
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  password: varchar("password").notNull(),
  role: varchar("role").notNull().default("admin"), // RBAC integration
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true).notNull(),
});

// System configuration for moderation settings
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configKey: varchar("config_key").notNull().unique(),
  configValue: jsonb("config_value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User behavior tracking for warning escalation
export const userBehaviorScores = pgTable("user_behavior_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  warningCount: integer("warning_count").default(0),
  violationCount: integer("violation_count").default(0),
  lastWarningAt: timestamp("last_warning_at"),
  nextEscalationLevel: integer("next_escalation_level").default(1),
  behaviorScore: integer("behavior_score").default(100), // 0-100, lower is worse
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isOnline: true,
  lastSeen: true,
});

export const registerUserSchema = createInsertSchema(users).omit({
  id: true,
  isOnline: true,
  lastSeen: true,
}).extend({
  confirmPassword: z.string().min(6),
  age: z.number().min(18, "You must be at least 18 years old").max(100, "Please enter a valid age"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  sequenceId: true,
});

export const insertUserPhotoSchema = createInsertSchema(userPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertRoomMemberSchema = createInsertSchema(roomMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertBlockedUserSchema = createInsertSchema(blockedUsers).omit({
  id: true,
  blockedAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  reportedAt: true,
  reviewedAt: true,
});

export const reportSchema = z.object({
  reportedUserId: z.string().min(1, "User ID is required"),
  reason: z.enum(["harassment", "spam", "inappropriate_content", "fake_profile", "other"]),
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
});

// New moderation schemas
export const insertModerationActionSchema = createInsertSchema(userModerationActions).omit({
  id: true,
  performedAt: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertUserBehaviorScoreSchema = createInsertSchema(userBehaviorScores).omit({
  id: true,
  updatedAt: true,
});

export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user must be selected"),
  actionType: z.enum(["ban", "unban", "block", "unblock", "delete", "warn"]),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  notes: z.string().optional(),
  severity: z.number().min(1).max(5).optional(),
});

export const warningEscalationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  severity: z.number().min(1).max(5).default(1),
  autoEscalate: z.boolean().default(true),
});

export const systemConfigUpdateSchema = z.object({
  configKey: z.string().min(1, "Config key is required"),
  configValue: z.any(),
  description: z.string().optional(),
});

export const updateReportStatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved", "dismissed"]),
  adminNotes: z.string().optional(),
});

// Notification settings schemas
export const insertNotificationSettingsSchema = createInsertSchema(userNotificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateNotificationSettingsSchema = insertNotificationSettingsSchema.partial();

// Notification schemas
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  read: true,
});

// Friend request schemas
export const insertFriendRequestSchema = createInsertSchema(friendRequests).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const friendRequestActionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

// Friendship schemas
export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
});

// Privacy settings schemas
export const insertPrivacySettingsSchema = createInsertSchema(userPrivacySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  profileVisibility: z.enum(["public", "friends", "private"]),
  allowDirectMessages: z.enum(["everyone", "friends", "nobody"]),
});

export const updatePrivacySettingsSchema = z.object({
  profileVisibility: z.enum(["public", "friends", "private"]).optional(),
  showOnlineStatus: z.boolean().optional(),
  showLastSeen: z.boolean().optional(),
  showAge: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  allowDirectMessages: z.enum(["everyone", "friends", "nobody"]).optional(),
  showPhotosToStrangers: z.boolean().optional(),
  discoverableInSearch: z.boolean().optional(),
  allowMentions: z.boolean().optional(),
});

export const warnUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
});

export const banUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
  permanent: z.boolean().default(false),
  duration: z.number().optional(), // Duration in hours for temporary bans
});

export const updateUserProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  age: z.number().min(18, "You must be at least 18 years old").max(100, "Please enter a valid age").optional(),
  gender: z.enum(["male", "female", "non-binary", "other"]).optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  location: z.string().min(1, "Location is required"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  genderPreference: z.enum(["male", "female", "all"]),
  ageMin: z.number().min(18).max(99),
  ageMax: z.number().min(18).max(99),
}).refine((data) => data.ageMin <= data.ageMax, {
  message: "Minimum age must be less than or equal to maximum age",
  path: ["ageMax"],
});

export type User = typeof users.$inferSelect & {
  primaryPhoto?: {
    id: string;
    photoUrl: string;
    fileName: string;
    isPrimary: boolean;
  } | null;
};
export type Room = typeof rooms.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertRoomMember = z.infer<typeof insertRoomMemberSchema>;
export type UserPhoto = typeof userPhotos.$inferSelect;
export type InsertUserPhoto = z.infer<typeof insertUserPhotoSchema>;
export type BlockedUser = typeof blockedUsers.$inferSelect;
export type InsertBlockedUser = z.infer<typeof insertBlockedUserSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type CreateReport = z.infer<typeof reportSchema>;
export type UpdateReportStatus = z.infer<typeof updateReportStatusSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type UserModerationAction = typeof userModerationActions.$inferSelect;
export type WarnUser = z.infer<typeof warnUserSchema>;
export type BanUser = z.infer<typeof banUserSchema>;
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type UpdateNotificationSettings = z.infer<typeof updateNotificationSettingsSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type FriendRequestAction = z.infer<typeof friendRequestActionSchema>;
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type InsertPrivacySettings = z.infer<typeof insertPrivacySettingsSchema>;
export type UpdatePrivacySettings = z.infer<typeof updatePrivacySettingsSchema>;

// Admin types
export type AdminUser = typeof adminUsers.$inferSelect;
export const adminLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Additional admin action schemas for better validation
export const adminBlockUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
});

export const adminUnblockUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const adminSendMessageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  message: z.string().min(1, "Message is required").max(1000, "Message must be less than 1000 characters"),
  messageType: z.string().default("admin_notification"),
});

export const adminCreateRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100, "Room name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  isPrivate: z.boolean().default(false),
});

export const adminDeleteRoomSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
});

export type MessageWithUser = Message & {
  user: User;
  isTemporary?: boolean;
};

export interface UserWithDistance extends User {
  distance?: number;
  duration?: number; // Travel time in minutes
  distanceMode?: string; // 'driving', 'walking', 'straight_line', etc.
}

export type UserWithPhotos = User & {
  photos: UserPhoto[];
  primaryPhoto?: UserPhoto;
};

export type PrivateRoom = {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1: User;
  participant2: User;
};

export type RoomWithMembers = Room & {
  memberCount: number;
  members: User[];
};

export type PrivateChatData = {
  rooms: Room[];
  privateRooms: PrivateRoom[];
};

export type BlockedUserWithDetails = BlockedUser & {
  blockedUser: User;
};

export type UserProfileSettings = {
  user: User;
  photos: UserPhoto[];
  primaryPhoto?: UserPhoto;
  blockedUsers: BlockedUserWithDetails[];
};

export type ReportWithDetails = Report & {
  reporter: User;
  reportedUser: User;
  reviewedByUser?: User;
};

export type UserModerationActionWithDetails = UserModerationAction & {
  user: User;
  performedByUser: User;
};

export type ModerationData = {
  reports: ReportWithDetails[];
  pendingCount: number;
  totalCount: number;
  recentActions: UserModerationActionWithDetails[];
  bannedUsersCount: number;
  totalWarnings: number;
};

export type AdminDashboardStats = {
  totalUsers: number;
  bannedUsers: number;
  pendingReports: number;
  totalReports: number;
  recentWarnings: number;
  activeUsers: number;
};

export type FriendRequestWithUser = FriendRequest & {
  sender: User;
  receiver: User;
};

export type FriendshipWithUser = Friendship & {
  friend: User;
};

export type UserWithFriendStatus = User & {
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  friendshipId?: string;
  friendRequestId?: string;
};

export type PaginationParams = {
  limit?: number;
  before?: string; // cursor for pagination
  after?: string; // cursor for pagination
};

export type PaginatedResponse<T> = {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
  totalCount?: number;
};

// New moderation types
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ModerationAction = typeof userModerationActions.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertUserBehaviorScore = z.infer<typeof insertUserBehaviorScoreSchema>;
export type UserBehaviorScore = typeof userBehaviorScores.$inferSelect;
export type BulkUserAction = z.infer<typeof bulkUserActionSchema>;
export type WarningEscalation = z.infer<typeof warningEscalationSchema>;
export type SystemConfigUpdate = z.infer<typeof systemConfigUpdateSchema>;

export type ModerationActionWithDetails = ModerationAction & {
  user: User;
  performedByUser: User;
};

export type UserWithBehaviorScore = User & {
  behaviorScore?: UserBehaviorScore;
  warningCount: number;
  violationCount: number;
};

export type SystemModerationStats = {
  totalActions: number;
  recentActions: ModerationActionWithDetails[];
  warningEscalations: number;
  behaviorScoreAverage: number;
  autoModerationEvents: number;
  cleanupOperations: number;
};

// Role-based Access Control (RBAC) System
export const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator', 
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const PERMISSIONS = {
  // User management permissions
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  BAN_USERS: 'ban_users',
  UNBAN_USERS: 'unban_users',
  
  // Chat moderation permissions
  VIEW_REPORTS: 'view_reports',
  MANAGE_REPORTS: 'manage_reports',
  MODERATE_MESSAGES: 'moderate_messages',
  DELETE_MESSAGES: 'delete_messages',
  
  // Room management permissions
  VIEW_ROOMS: 'view_rooms',
  MANAGE_ROOMS: 'manage_rooms',
  CREATE_ROOMS: 'create_rooms',
  DELETE_ROOMS: 'delete_rooms',
  
  // System administration permissions
  VIEW_ADMIN_DASHBOARD: 'view_admin_dashboard',
  MANAGE_SYSTEM_CONFIG: 'manage_system_config',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_DATABASE: 'manage_database',
  
  // Advanced moderation permissions
  VIEW_MODERATION_ACTIONS: 'view_moderation_actions',
  PERFORM_BULK_ACTIONS: 'perform_bulk_actions',
  MANAGE_USER_BEHAVIOR: 'manage_user_behavior',
  CONFIGURE_AUTO_MODERATION: 'configure_auto_moderation',
  
  // Super admin permissions
  MANAGE_ADMINS: 'manage_admins',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  FULL_DATABASE_ACCESS: 'full_database_access'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role permissions mapping - carefully separated for security
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [USER_ROLES.USER]: [
    // Users have no admin permissions by default
  ],
  [USER_ROLES.MODERATOR]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_REPORTS,
    PERMISSIONS.MODERATE_MESSAGES,
    PERMISSIONS.VIEW_ROOMS,
    PERMISSIONS.VIEW_MODERATION_ACTIONS
  ],
  [USER_ROLES.ADMIN]: [
    // Admin permissions - comprehensive but not super-admin level
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.BAN_USERS,
    PERMISSIONS.UNBAN_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_REPORTS,
    PERMISSIONS.MODERATE_MESSAGES,
    PERMISSIONS.DELETE_MESSAGES,
    PERMISSIONS.VIEW_ROOMS,
    PERMISSIONS.MANAGE_ROOMS,
    PERMISSIONS.CREATE_ROOMS,
    PERMISSIONS.DELETE_ROOMS,
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_SYSTEM_CONFIG,
    PERMISSIONS.VIEW_SYSTEM_LOGS,
    PERMISSIONS.MANAGE_DATABASE,
    PERMISSIONS.VIEW_MODERATION_ACTIONS,
    PERMISSIONS.PERFORM_BULK_ACTIONS,
    PERMISSIONS.MANAGE_USER_BEHAVIOR,
    PERMISSIONS.CONFIGURE_AUTO_MODERATION
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    // Super admin has ALL permissions including dangerous ones
    ...Object.values(PERMISSIONS) as Permission[]
  ]
};

// Helper functions for role-based access control
export const hasPermission = (userRole: UserRole, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
};

export const hasAnyPermission = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission));
};

export const hasAllPermissions = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(userRole, permission));
};

// Role hierarchy levels (for minimum role checks - no automatic inheritance)
export const getRoleLevel = (role: UserRole): number => {
  switch (role) {
    case USER_ROLES.USER: return 1;
    case USER_ROLES.MODERATOR: return 2;
    case USER_ROLES.ADMIN: return 3;
    case USER_ROLES.SUPER_ADMIN: return 4;
    default: return 0;
  }
};

export const hasMinimumRole = (userRole: UserRole, minimumRole: UserRole): boolean => {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
};

// RBAC validation schemas
export const roleValidationSchema = z.enum([
  USER_ROLES.USER,
  USER_ROLES.MODERATOR, 
  USER_ROLES.ADMIN,
  USER_ROLES.SUPER_ADMIN
]);

export const permissionValidationSchema = z.enum(Object.values(PERMISSIONS) as [Permission, ...Permission[]]);

// Role assignment and management types
export type RoleAssignment = {
  userId: string;
  role: UserRole;
  assignedBy: string;
  assignedAt: Date;
  reason?: string;
};

export type PermissionCheck = {
  userId: string;
  userRole: UserRole;
  requiredPermission: Permission;
  hasAccess: boolean;
};