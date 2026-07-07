import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db } from '../config/database';
import { JwtPayload, MessageRecord, ReactionRecord } from '../types';

const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
const socketUser = new Map<string, string>(); // socketId -> userId

function getUserIdFromSocket(socket: Socket): string | null {
  try {
    const token = (socket.handshake.auth as any).token as string;
    if (!token) return null;
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return payload.userId;
  } catch {
    return null;
  }
}

function setUserOnline(userId: string, online: boolean) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?').run(online ? 1 : 0, now, userId);
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const userId = getUserIdFromSocket(socket);
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socketUser.set(socket.id, userId);
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);
    setUserOnline(userId, true);

    io.emit('user_status', { userId, isOnline: true, lastSeen: Math.floor(Date.now() / 1000) });

    socket.on('join_conversation', (conversationId: string) => {
      const participant = db.prepare(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(conversationId, userId);
      if (participant) socket.join(`conv:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing_start', (conversationId: string) => {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
      socket.to(`conv:${conversationId}`).emit('user_typing', {
        userId,
        username: user?.username ?? 'Someone',
        conversationId,
      });
    });

    socket.on('typing_stop', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('user_stopped_typing', { userId, conversationId });
    });

    socket.on('mark_read', (conversationId: string) => {
      const isParticipant = db.prepare(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(conversationId, userId);
      if (!isParticipant) return;

      const now = Math.floor(Date.now() / 1000);
      const unread = db.prepare(`
        SELECT id FROM messages WHERE conversation_id = ? AND sender_id != ? AND id NOT IN (
          SELECT message_id FROM message_reads WHERE user_id = ?
        ) AND is_deleted = 0
      `).all(conversationId, userId, userId) as Array<{ id: string }>;

      if (unread.length > 0) {
        const insert = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)');
        db.exec('BEGIN');
        try {
          for (const r of unread) insert.run((r as any).id as string, userId, now);
          db.exec('COMMIT');
        } catch { db.exec('ROLLBACK'); }
        socket.to(`conv:${conversationId}`).emit('messages_read', {
          conversationId,
          userId,
          messageIds: unread.map((r: any) => r.id as string),
        });
      }
    });

    socket.on('disconnect', () => {
      socketUser.delete(socket.id);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          setUserOnline(userId, false);
          io.emit('user_status', { userId, isOnline: false, lastSeen: Math.floor(Date.now() / 1000) });
        }
      }
    });
  });
}

export function emitNewMessage(io: Server, conversationId: string, message: MessageRecord): void {
  io.to(`conv:${conversationId}`).emit('new_message', message);
}

export function emitMessageUpdated(io: Server, conversationId: string, update: {
  id: string; encryptedContent: string; nonce: string; isEdited: boolean; isDeleted: boolean; updatedAt: number;
}): void {
  io.to(`conv:${conversationId}`).emit('message_updated', update);
}

export function emitReactionUpdated(io: Server, conversationId: string, messageId: string, reactions: ReactionRecord[]): void {
  io.to(`conv:${conversationId}`).emit('message_reaction_updated', { messageId, reactions });
}

export function emitMessagesRead(io: Server, conversationId: string, userId: string, messageIds: string[]): void {
  io.to(`conv:${conversationId}`).emit('messages_read', { conversationId, userId, messageIds });
}
