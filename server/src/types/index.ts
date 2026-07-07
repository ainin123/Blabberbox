import { Request } from 'express';
import { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  bio: string;
  avatar_color: string;
  public_key: string;
  is_online: number;
  last_seen: number;
  show_read_receipts: number;
  dark_mode: number;
  created_at: number;
  updated_at: number;
}

export interface UserPublic {
  id: string;
  username: string;
  bio: string;
  avatarColor: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: number;
  showReadReceipts: boolean;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  nonce: string;
  is_edited: number;
  is_deleted: number;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface ReactionRecord {
  emoji: string;
  userId: string;
  username: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; username: string; avatarColor: string };
  encryptedContent: string;
  nonce: string;
  isEdited: boolean;
  isDeleted: boolean;
  parentId: string | null;
  reactions: ReactionRecord[];
  readBy: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationRow {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface ConversationRecord {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  participants: UserPublic[];
  lastMessage: MessageRecord | null;
  unreadCount: number;
  createdAt: number;
}

export interface JwtPayload extends BaseJwtPayload {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPublic;
}

export function toUserPublic(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    avatarColor: row.avatar_color,
    publicKey: row.public_key,
    isOnline: row.is_online === 1,
    lastSeen: row.last_seen,
    showReadReceipts: row.show_read_receipts === 1,
  };
}
