import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../config/database';
import { config } from '../config/env';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest, UserRow, toUserPublic } from '../types';

const router = Router();

function generateTokens(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refreshToken = jwt.sign({ userId }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn as any });
  return { token, refreshToken };
}

function storeRefreshToken(userId: string, refreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), userId, tokenHash, expiresAt);
}

function isValidUsername(u: string) { return /^[a-zA-Z0-9_]{3,20}$/.test(u); }
function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const { username, email, password, publicKey } = req.body;

  if (!username || !isValidUsername(username)) {
    res.status(400).json({ success: false, error: 'Username must be 3-20 chars, letters/numbers/underscores only.' });
    return;
  }
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ success: false, error: 'That email looks sus. Try again.' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 chars. Security matters, even for gossip.' });
    return;
  }
  if (!publicKey) {
    res.status(400).json({ success: false, error: 'Missing encryption key. How do you expect us to encrypt your gossip?' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    res.status(409).json({ success: false, error: 'That username or email is already taken. Someone beat you to the gossip throne.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const userId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, public_key, bio, avatar_color, is_online, last_seen, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '', '#FF6B9D', 1, ?, ?, ?)
  `).run(userId, username, email, passwordHash, publicKey, now, now, now);

  const { token, refreshToken } = generateTokens(userId);
  storeRefreshToken(userId, refreshToken);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
  res.status(201).json({ success: true, data: { token, refreshToken, user: toUserPublic(user) } });
});

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required to resume your yapping.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as unknown as UserRow | undefined;
  if (!user) {
    res.status(401).json({ success: false, error: 'Wrong credentials. Even we have standards around here.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Wrong password. Your gossip pass is denied.' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET is_online = 1, last_seen = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);

  const { token, refreshToken } = generateTokens(user.id);
  storeRefreshToken(user.id, refreshToken);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as unknown as UserRow;
  res.json({ success: true, data: { token, refreshToken, user: toUserPublic(updatedUser) } });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token required.' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string };
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = db.prepare(
      'SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > ?'
    ).get(payload.userId, tokenHash, Math.floor(Date.now() / 1000));

    if (!stored) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token.' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = jwt.sign({ userId: payload.userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    res.json({ success: true, data: { token } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token. Time to log in again!' });
  }
});

router.post('/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?').run(now, userId);
  res.json({ success: true, data: { message: 'Gossip session ended. See ya!' } });
});

router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
});

export default router;
