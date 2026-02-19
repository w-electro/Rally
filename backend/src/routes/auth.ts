import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, generateTokens, AuthPayload } from '../middleware/auth';
import { createRefreshToken, rotateRefreshToken, revokeUserTokens } from '../services/token';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or fewer')
    .transform((v) => v.toLowerCase().trim()),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be 32 characters or fewer')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username may only contain letters, numbers, and underscores',
    )
    .transform((v) => v.toLowerCase().trim()),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(64, 'Display name must be 64 characters or fewer')
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { email, username, displayName, password } = parsed.data;

    // Check for existing user by email or username
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictError('An account with this email already exists');
      }
      throw new ConflictError('Username is already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const payload: AuthPayload = { userId: user.id, username: user.username };
    const { accessToken } = generateTokens(payload);
    const refreshToken = await createRefreshToken(user.id);

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { email, password } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const payload: AuthPayload = { userId: user.id, username: user.username };
    const { accessToken } = generateTokens(payload);
    const refreshToken = await createRefreshToken(user.id);

    // Update user status to ONLINE
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE' },
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        status: 'ONLINE',
        customStatus: user.customStatus,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { refreshToken } = parsed.data;

    const result = await rotateRefreshToken(refreshToken);

    if (!result) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    // Revoke all refresh tokens for this user
    await revokeUserTokens(req.user.userId);

    // Set user status to OFFLINE
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { status: 'OFFLINE' },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        status: true,
        customStatus: true,
        currentGame: true,
        isStreaming: true,
        isVerified: true,
        gamingStats: true,
        linkedAccounts: true,
        dmPrivacy: true,
        profilePrivacy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
