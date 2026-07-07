import { db } from '../config/database';
import { MessageRecord, ReactionRecord, UserPublic, ConversationRecord, UserRow, toUserPublic } from '../types';

export function buildMessageRecord(messageId: string): MessageRecord | null {
  const msg = db.prepare(`
    SELECT m.*, u.username as sender_username, u.avatar_color as sender_avatar_color
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(messageId) as any;
  if (!msg) return null;

  const reactions = db.prepare(`
    SELECT mr.emoji, mr.user_id, u.username
    FROM message_reactions mr
    JOIN users u ON u.id = mr.user_id
    WHERE mr.message_id = ?
  `).all(messageId) as any[];

  const reads = db.prepare('SELECT user_id FROM message_reads WHERE message_id = ?').all(messageId) as any[];

  return {
    id: msg.id as string,
    conversationId: msg.conversation_id as string,
    senderId: msg.sender_id as string,
    sender: { id: msg.sender_id as string, username: msg.sender_username as string, avatarColor: msg.sender_avatar_color as string },
    encryptedContent: msg.encrypted_content as string,
    nonce: msg.nonce as string,
    isEdited: msg.is_edited === 1,
    isDeleted: msg.is_deleted === 1,
    parentId: msg.parent_id as string | null,
    reactions: reactions.map((r): ReactionRecord => ({ emoji: r.emoji as string, userId: r.user_id as string, username: r.username as string })),
    readBy: reads.map((r: any) => r.user_id as string),
    createdAt: msg.created_at as number,
    updatedAt: msg.updated_at as number,
  };
}

export function buildConversationRecord(conversationId: string, currentUserId: string): ConversationRecord | null {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as any;
  if (!conv) return null;

  const participantRows = db.prepare(`
    SELECT u.* FROM users u
    JOIN conversation_participants cp ON cp.user_id = u.id
    WHERE cp.conversation_id = ?
  `).all(conversationId) as unknown as UserRow[];

  const participants: UserPublic[] = participantRows.map(toUserPublic);

  const lastMsgRow = db.prepare(`
    SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(conversationId) as { id: string } | undefined;

  const lastMessage = lastMsgRow ? buildMessageRecord(lastMsgRow.id as string) : null;

  const unreadRow = db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    WHERE m.conversation_id = ?
      AND m.sender_id != ?
      AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)
      AND m.is_deleted = 0
  `).get(conversationId, currentUserId, currentUserId) as any;

  return {
    id: conv.id as string,
    type: conv.type as 'direct' | 'group',
    name: conv.name as string | null,
    participants,
    lastMessage,
    unreadCount: unreadRow.count as number,
    createdAt: conv.created_at as number,
  };
}
