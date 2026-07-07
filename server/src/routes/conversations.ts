import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { buildConversationRecord } from '../utils/helpers';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const rows = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(userId) as Array<{ id: string }>;

  const conversations = rows
    .map(r => buildConversationRecord(r.id, userId))
    .filter(Boolean);

  res.json({ success: true, data: { conversations } });
});

router.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { participantId } = req.body;
  const currentUserId = req.user!.id;

  if (!participantId || participantId === currentUserId) {
    res.status(400).json({ success: false, error: 'Invalid participant. You cannot gossip with yourself.' });
    return;
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(participantId);
  if (!target) {
    res.status(404).json({ success: false, error: 'That blabber does not exist.' });
    return;
  }

  const blocked = db.prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)'
  ).get(currentUserId, participantId, participantId, currentUserId);
  if (blocked) {
    res.status(403).json({ success: false, error: 'Cannot start a gossip session with a muted fool.' });
    return;
  }

  // Check if DM already exists
  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
    JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
    WHERE c.type = 'direct'
  `).get(currentUserId, participantId) as { id: string } | undefined;

  if (existing) {
    const conv = buildConversationRecord(existing.id, currentUserId);
    res.json({ success: true, data: { conversation: conv } });
    return;
  }

  const convId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO conversations (id, type, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(convId, 'direct', currentUserId, now, now);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, currentUserId);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(convId, participantId);

  const conv = buildConversationRecord(convId, currentUserId);
  res.status(201).json({ success: true, data: { conversation: conv } });
});

router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const participant = db.prepare(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
  ).get(req.params.id, userId);
  if (!participant) {
    res.status(403).json({ success: false, error: 'You are not part of this gossip session.' });
    return;
  }
  const conv = buildConversationRecord(req.params.id, userId);
  if (!conv) {
    res.status(404).json({ success: false, error: 'Gossip session not found.' });
    return;
  }
  res.json({ success: true, data: { conversation: conv } });
});

router.post('/group', (req: AuthenticatedRequest, res: Response) => {
  const { name, participantIds } = req.body;
  const currentUserId = req.user!.id;

  if (!name || name.trim().length < 2) {
    res.status(400).json({ success: false, error: 'Group name must be at least 2 chars.' });
    return;
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ success: false, error: 'Add at least one other blabber to the squad.' });
    return;
  }
  const allIds = [...new Set([currentUserId, ...participantIds])];
  if (allIds.length > 50) {
    res.status(400).json({ success: false, error: 'Max 50 blabbers per squad session.' });
    return;
  }

  const convId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO conversations (id, type, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(convId, 'group', name.trim(), currentUserId, now, now);

  const insertParticipant = db.prepare('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
  for (const uid of allIds) {
    insertParticipant.run(convId, uid);
  }

  const conv = buildConversationRecord(convId, currentUserId);
  res.status(201).json({ success: true, data: { conversation: conv } });
});

export default router;
