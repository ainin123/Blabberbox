import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db } from '../config/database';
import { AuthenticatedRequest, JwtPayload, UserRow, toUserPublic } from '../types';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized blabber! Who are you?' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized blabber! Who are you?' });
      return;
    }
    req.user = toUserPublic(user);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Your gossip pass has expired. Log in again!' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    if (user) req.user = toUserPublic(user);
  } catch {
    // ignore
  }
  next();
}
