import { Router, Response } from 'express';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest, UserRow, toUserPublic } from '../types';

const router = Router();
router.use(authenticate);

router.get('/search', (req: AuthenticatedRequest, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (!q || q.length < 2) {
    res.json({ success: true, data: { users: [] } });
    return;
  }

  const blockedIds = (db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?').all(req.user!.id) as any[]).map((r: any) => r.blocked_id as string);
  const blockerIds = (db.prepare('SELECT blocker_id FROM blocks WHERE blocked_id = ?').all(req.user!.id) as any[]).map((r: any) => r.blocker_id as string);
  const excludeIds = [...new Set([req.user!.id, ...blockedIds, ...blockerIds])];

  const placeholders = excludeIds.map(() => '?').join(',');
  const users = db.prepare(`
    SELECT * FROM users
    WHERE username LIKE ? AND id NOT IN (${placeholders})
    LIMIT 20
  `).all(`%${q}%`, ...excludeIds) as unknown as UserRow[];

  res.json({ success: true, data: { users: users.map(toUserPublic) } });
});

router.get('/blocked', (req: AuthenticatedRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.* FROM users u
    JOIN blocks b ON b.blocked_id = u.id
    WHERE b.blocker_id = ?
  `).all(req.user!.id) as unknown as UserRow[];
  res.json({ success: true, data: { users: users.map(toUserPublic) } });
});

router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as unknown as UserRow | undefined;
  if (!user) {
    res.status(404).json({ success: false, error: 'Blabber not found. They might have ghosted the app.' });
    return;
  }
  res.json({ success: true, data: { user: toUserPublic(user) } });
});

router.put('/profile', (req: AuthenticatedRequest, res: Response) => {
  const { bio, avatarColor, showReadReceipts, darkMode } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (bio !== undefined) { updates.push('bio = ?'); values.push(String(bio).slice(0, 200)); }
  if (avatarColor !== undefined) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(avatarColor)) {
      res.status(400).json({ success: false, error: 'Invalid color. We only accept proper hex codes around here.' });
      return;
    }
    updates.push('avatar_color = ?'); values.push(avatarColor);
  }
  if (showReadReceipts !== undefined) { updates.push('show_read_receipts = ?'); values.push(showReadReceipts ? 1 : 0); }
  if (darkMode !== undefined) { updates.push('dark_mode = ?'); values.push(darkMode ? 1 : 0); }

  if (updates.length === 0) {
    res.status(400).json({ success: false, error: 'Nothing to update, chief.' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  updates.push('updated_at = ?'); values.push(now);
  values.push(req.user!.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as unknown as UserRow;
  res.json({ success: true, data: { user: toUserPublic(user) } });
});

router.post('/:id/block', (req: AuthenticatedRequest, res: Response) => {
  const blockerId = req.user!.id;
  const blockedId = req.params.id;
  if (blockerId === blockedId) {
    res.status(400).json({ success: false, error: "You can't mute yourself. That's just... dramatic." });
    return;
  }
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(blockedId);
  if (!target) {
    res.status(404).json({ success: false, error: 'Blabber not found.' });
    return;
  }
  db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
  res.json({ success: true, data: { message: 'Fool successfully muted.' } });
});

router.delete('/:id/block', (req: AuthenticatedRequest, res: Response) => {
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user!.id, req.params.id);
  res.json({ success: true, data: { message: 'Fool unmuted. You brave soul.' } });
});

export default router;
