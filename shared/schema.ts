import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  password: text("password").notNull(),
  gender: text("gender").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  genderPreference: text("gender_preference").notNull().default("all"), // "male", "female", "all"
  ageMin: integer("age_min").default(18),
  ageMax: integer("age_max").default(99),
  role: text("role").notNull().default("user"),
  avatar: text("avatar"),
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  lastSeen: integer("last_seen", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  createdBy: text("created_by").references(() => users.id),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  roomId: text("room_id").notNull().references(() => rooms.id),
  timestamp: integer("timestamp", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  photoUrl: text("photo_url"),
  photoFileName: text("photo_file_name"),
  messageType: text("message_type").notNull().default("text"), // "text", "photo"
});

// User profile photos table
export const userPhotos = sqliteTable("user_photos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  fileName: text("file_name").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const roomMembers = sqliteTable("room_members", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  userId: text("user_id").notNull().references(() => users.id),
  joinedAt: integer("joined_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// Blocked users table
export const blockedUsers = sqliteTable("blocked_users", {
  id: text("id").primaryKey(),
  blockerId: text("blocker_id").notNull().references(() => users.id),
  blockedId: text("blocked_id").notNull().references(() => users.id),
  blockedAt: integer("blocked_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  reason: text("reason"), // Optional reason for blocking
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
  timestamp: true,
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

export const updateUserProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
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

export type User = typeof users.$inferSelect;
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
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type MessageWithUser = Message & {
  user: User;
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
