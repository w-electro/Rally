import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import config from './config';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import serverRoutes from './routes/servers';
import { initializeSocket } from './socket';
import { globalErrorHandler } from './utils/errors';

const app = express();
const httpServer = createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Static files ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(config.uploadDir));
app.use('/downloads', express.static(path.resolve(process.cwd(), '..', 'downloads')));

// ─── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler ──────────────────────────────────────────────────────────
app.use(globalErrorHandler);

// ─── Socket.io ──────────────────────────────────────────────────────────────
initializeSocket(httpServer);

// ─── Start server ───────────────────────────────────────────────────────────
httpServer.listen(config.port, () => {
  console.log(`Rally backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

export default app;
