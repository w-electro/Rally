import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './utils/errors';
import { createSocketServer } from './socket';
import { setupWebRTCSignaling } from './webrtc/signaling';

// Route imports
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import userRoutes from './routes/users';
import feedRoutes from './routes/feed';
import storyRoutes from './routes/stories';
import pulseRoutes from './routes/pulse';
import pointsRoutes from './routes/points';
import streamRoutes from './routes/stream';
import aiRoutes from './routes/ai';
import commerceRoutes from './routes/commerce';
import gamingRoutes from './routes/gaming';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/gaming', gamingRoutes);

// Error handler
app.use(errorHandler);

// WebSocket server
const io = createSocketServer(httpServer);
setupWebRTCSignaling(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║          RALLY SERVER v1.0.0          ║
  ╠═══════════════════════════════════════╣
  ║  HTTP:   http://localhost:${config.port}       ║
  ║  WS:     ws://localhost:${config.port}         ║
  ║  Mode:   ${config.nodeEnv.padEnd(27)}║
  ╚═══════════════════════════════════════╝
  `);
});

export { app, httpServer, io };
