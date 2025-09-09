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
});

// User warnings/bans tracking table
export const userModerationActions = pgTable("user_moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionType: varchar("action_type").notNull(), // "warning", "ban", "unban"
  reason: text("reason").notNull(),
  notes: text("notes"),
  performedBy: varchar("performed_by").notNull().references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // For temporary bans
});

// Reports table for user reporting system
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id),
  reason: varchar("reason").notNull(), // "harassment", "spam", "inappropriate_content", "fake_profile", "other"
  description: text("description"), // Detailed description of the report
  status: varchar("status").notNull().default("pending"), // "pending", "reviewed", "resolved", "dismissed"
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
  emailDailySummary: boolean('email_daily_summary').default(false).notNull(),
  emailWeeklyHighlights: boolean('email_weekly_highlights').default(true).notNull(),
  emailImportantUpdates: boolean('email_important_updates').default(true).notNull(),
  emailSecurityAlerts: boolean('email_security_alerts').default(true).notNull(),
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

export const updateReportStatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved", "dismissed"]),
  adminNotes: z.string().optional(),
});

export const insertModerationActionSchema = createInsertSchema(userModerationActions).omit({
  id: true,
  performedAt: true,
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
});

export const updatePrivacySettingsSchema = insertPrivacySettingsSchema.partial();

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
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
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

export type MessageWithUser = Message & {
  user: User;
  isTemporary?: boolean;
};

export type UserWithDistance = User & {
  distance?: number;
};

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
