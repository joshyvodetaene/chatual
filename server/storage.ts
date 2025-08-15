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
  type UserWithDistance
} from "@shared/schema";
import { SQLiteStorage } from "./sqlite-storage";
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

  // Room member methods
  addRoomMember(roomMember: InsertRoomMember): Promise<RoomMember>;
  removeRoomMember(roomId: string, userId: string): Promise<void>;
  getRoomMembers(roomId: string): Promise<User[]>;
  getUserRooms(userId: string): Promise<Room[]>;
  isUserInRoom(roomId: string, userId: string): Promise<boolean>;

  // Message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getRoomMessages(roomId: string, limit?: number): Promise<MessageWithUser[]>;
}

export const storage = new SQLiteStorage();
