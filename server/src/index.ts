import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { initDb } from './config/database';
import { apiLimiter } from './middleware/rateLimiter';
import { setupSocketHandlers } from './socket/handler';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
const corsOrigin = config.clientUrl === '*' ? true : config.clientUrl;
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiLimiter);

initDb();

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'Actively yapping!', timestamp: Date.now() } });
});

// In production, serve the React build and handle client-side routing
if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: "404: That endpoint does not exist. Were you trying to gossip somewhere you shouldn't?" });
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: "Oops! Even our servers have bad days." });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
setupSocketHandlers(io);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n🦉 BLABBERBOX Server is Actively Yapping on port ${config.port}`);
  console.log(`   Where gossip meets encryption — chat away, worry-free!`);
  console.log(`   Client URL: ${config.clientUrl}`);
  console.log(`   Environment: ${config.nodeEnv}\n`);
});

export default app;
