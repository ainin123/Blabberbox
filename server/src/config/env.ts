import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? 'blabberbox-dev-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'blabberbox-dev-refresh-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  dbPath: process.env.DB_PATH ?? './blabberbox.db',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
};
