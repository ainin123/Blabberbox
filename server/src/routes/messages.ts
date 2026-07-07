import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { messageLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types';
import { buildMessageRecord } from '../utils/helpers';
import { Server } from 'socket.io';
import { emitNewMessage, emitMessageUpdated, emitReactionUpdated, emitMessagesRead } from '../socket/handler';

const router = Router();
router.use(authenticate);

function isParticipant(conversationId: string, userId: string): boolean {
  return !!db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId);
}

router.get('/:conversationId', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  if (!isParticipant(conversationId, userId)) {
    res.status(403).json({ success: false, error: 'You are not part of this gossip session.' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string ?? '50', 10), 100);
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;

  let rows: Array<{ id: string }>;
  if (before) {
    rows = db.prepare(`
      SELECT id FROM messages WHERE conversation_id = ? AND created_at < ?
      ORDER BY created_at DESC LIMIT ?
    `).all(conversationId, before, limit) as unknown as Array<{ id: string }>;
  } else {
    rows = db.prepare(`
      SELECT id FROM messages WHERE conversation_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(conversationId, limit) as unknown as Array<{ id: string }>;
  }

  const messages = rows.reverse().map(r => buildMessageRecord(r.id)).filter(Boolean);
  res.json({ success: true, data: { messages } });
});

router.post('/', messageLimiter, (req: AuthenticatedRequest, res: Response) => {
  const { conversationId, encryptedContent, nonce, parentId } = req.body;
  const userId = req.user!.id;

  if (!conversationId || !encryptedContent || !nonce) {
    res.status(400).json({ success: false, error: 'Missing required fields. Even gossip needs structure.' });
    return;
  }
  if (!isParticipant(conversationId, userId)) {
    res.status(403).json({ success: false, error: 'You are not part of this gossip session.' });
    return;
  }

  const msgId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, encrypted_content, nonce, parent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, conversationId, userId, encryptedContent, nonce, parentId ?? null, now, now);

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

  const message = buildMessageRecord(msgId)!;
  const io: Server = req.app.get('io');
  emitNewMessage(io, conversationId, message);

  res.status(201).json({ success: true, data: { message } });
});

router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;

  if (!msg) { res.status(404).json({ success: false, error: 'Message not found.' }); return; }
  if (msg.sender_id !== userId) { res.status(403).json({ success: false, error: 'You can only edit your own blabber.' }); return; }
  if (msg.is_deleted) { res.status(400).json({ success: false, error: "Can't edit what you already unsaid." }); return; }

  const { encryptedContent, nonce } = req.body;
  if (!encryptedContent || !nonce) { res.status(400).json({ success: false, error: 'Missing content or nonce.' }); return; }

  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE messages SET encrypted_content = ?, nonce = ?, is_edited = 1, updated_at = ? WHERE id = ?').run(encryptedContent, nonce, now, req.params.id);

  const updated = buildMessageRecord(req.params.id)!;
  const io: Server = req.app.get('io');
  emitMessageUpdated(io, msg.conversation_id, { id: updated.id, encryptedContent: updated.encryptedContent, nonce: updated.nonce, isEdited: true, isDeleted: false, updatedAt: updated.updatedAt });

  res.json({ success: true, data: { message: updated } });
});

router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;

  if (!msg) { res.status(404).json({ success: false, error: 'Message not found.' }); return; }
  if (msg.sender_id !== userId) { res.status(403).json({ success: false, error: 'You can only unsay your own blabber.' }); return; }

  const now = Math.floor(Date.now() / 1000);
  db.prepare("UPDATE messages SET is_deleted = 1, encrypted_content = '[deleted]', nonce = '', updated_at = ? WHERE id = ?").run(now, req.params.id);

  const io: Server = req.app.get('io');
  emitMessageUpdated(io, msg.conversation_id, { id: req.params.id, encryptedContent: '[deleted]', nonce: '', isEdited: false, isDeleted: true, updatedAt: now });

  res.json({ success: true, data: { message: 'Message unsaid successfully.' } });
});

router.post('/:id/react', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { emoji } = req.body;

  if (!emoji || emoji.length > 10) { res.status(400).json({ success: false, error: 'Invalid emoji.' }); return; }

  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!msg) { res.status(404).json({ success: false, error: 'Message not found.' }); return; }
  if (!isParticipant(msg.conversation_id, userId)) { res.status(403).json({ success: false, error: 'Not your gossip session.' }); return; }

  const existing = db.prepare('SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(req.params.id, userId, emoji);
  if (existing) {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(req.params.id, userId, emoji);
  } else {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)').run(req.params.id, userId, emoji, now);
  }

  const reactions = db.prepare(`
    SELECT mr.emoji, mr.user_id, u.username FROM message_reactions mr
    JOIN users u ON u.id = mr.user_id WHERE mr.message_id = ?
  `).all(req.params.id) as Array<{ emoji: string; user_id: string; username: string }>;

  const reactionRecords = reactions.map(r => ({ emoji: r.emoji, userId: r.user_id, username: r.username }));
  const io: Server = req.app.get('io');
  emitReactionUpdated(io, msg.conversation_id, req.params.id, reactionRecords);

  res.json({ success: true, data: { reactions: reactionRecords } });
});

router.delete('/:id/react/:emoji', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any;
  if (!msg) { res.status(404).json({ success: false, error: 'Message not found.' }); return; }

  db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(req.params.id, userId, req.params.emoji);

  const reactions = db.prepare(`
    SELECT mr.emoji, mr.user_id, u.username FROM message_reactions mr
    JOIN users u ON u.id = mr.user_id WHERE mr.message_id = ?
  `).all(req.params.id) as Array<{ emoji: string; user_id: string; username: string }>;

  const reactionRecords = reactions.map(r => ({ emoji: r.emoji, userId: r.user_id, username: r.username }));
  const io: Server = req.app.get('io');
  emitReactionUpdated(io, msg.conversation_id, req.params.id, reactionRecords);

  res.json({ success: true, data: { reactions: reactionRecords } });
});

router.post('/:conversationId/read', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;

  if (!isParticipant(conversationId, userId)) {
    res.status(403).json({ success: false, error: 'Not your gossip session.' });
    return;
  }

  const unread = db.prepare(`
    SELECT id FROM messages WHERE conversation_id = ? AND sender_id != ? AND id NOT IN (
      SELECT message_id FROM message_reads WHERE user_id = ?
    ) AND is_deleted = 0
  `).all(conversationId, userId, userId) as Array<{ id: string }>;

  if (unread.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    const insert = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)');
    db.exec('BEGIN');
    try {
      for (const r of unread) insert.run((r as any).id as string, userId, now);
      db.exec('COMMIT');
    } catch { db.exec('ROLLBACK'); }

    const io: Server = req.app.get('io');
    emitMessagesRead(io, conversationId, userId, unread.map((r: any) => r.id as string));
  }

  res.json({ success: true, data: { read: unread.length } });
});

export default router;
