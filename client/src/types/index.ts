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
  content?: string; // client-side decrypted
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

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}
