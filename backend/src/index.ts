import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './utils/errors';
import { createSocketServer } from './socket';
import { setIO } from './lib/socketInstance';

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
import inviteRoutes from './routes/invites';
import uploadRoutes from './routes/upload';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.nodeEnv === 'production' && config.corsOrigin
    ? config.corsOrigin.split(',').map((s: string) => s.trim())
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/upload', uploadLimiter);

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
app.use('/api', inviteRoutes);
app.use('/api/upload', uploadRoutes);

// Open Graph metadata endpoint for link previews
app.get('/api/og', async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query parameter required' });
  }
  try {
    new URL(url); // validate URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Rally-Bot/1.0 (Link Preview)' },
    });
    clearTimeout(timeout);

    const html = await response.text();
    const get = (prop: string) => {
      const match = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return match?.[1] ?? null;
    };
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;

    res.json({
      title: get('title') || titleTag,
      description: get('description'),
      image: get('image'),
      siteName: get('site_name'),
      url: get('url') || url,
    });
  } catch {
    res.status(422).json({ error: 'Could not fetch URL' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Error handler
app.use(errorHandler);

// WebSocket server (WebRTC signaling is handled inside the socket handler)
const io = createSocketServer(httpServer);
setIO(io);

// Start server
httpServer.listen(config.port, '0.0.0.0', () => {
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
