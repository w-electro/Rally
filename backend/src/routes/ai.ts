import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../utils/errors';

const router = Router();

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const summarizeSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  messageCount: z.number().int().min(1).max(200).default(50),
});

const welcomeSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  userId: z.string().uuid('Invalid user ID'),
  interests: z.array(z.string().max(100)).min(1, 'At least one interest is required').max(20),
});

const moderateSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be 10000 characters or fewer'),
});

const suggestChannelsSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  messageContent: z.string().min(1, 'Message content is required').max(5000),
});

const reportSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  days: z.number().int().min(1).max(90).default(7),
});

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(50)
    .default([]),
});

// ---------------------------------------------------------------------------
// Helper: call Claude API and store interaction
// ---------------------------------------------------------------------------

async function callClaude(
  userId: string,
  serverId: string | null,
  type: 'SUMMARY' | 'WELCOME' | 'MODERATION' | 'FAQ' | 'CHANNEL_SUGGEST' | 'REPORT' | 'GENERAL',
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{ text: string; tokensUsed: number }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  // Store interaction in the database
  await prisma.aiInteraction.create({
    data: {
      userId,
      serverId,
      type,
      input: userMessage,
      output: text,
      tokensUsed,
    },
  });

  return { text, tokensUsed };
}

// ---------------------------------------------------------------------------
// POST /summarize - Summarize channel messages
// ---------------------------------------------------------------------------

router.post('/summarize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = summarizeSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { channelId, messageCount } = parsed.data;
    const userId = req.user!.userId;

    // Verify the channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { server: { select: { id: true, name: true } } },
    });
    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    // Fetch last N messages from the channel
    const messages = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: messageCount,
      include: {
        author: {
          select: { username: true, displayName: true },
        },
      },
    });

    if (messages.length === 0) {
      throw new BadRequestError('No messages found in this channel');
    }

    // Reverse to chronological order
    const chronologicalMessages = messages.reverse();

    // Format messages for the AI
    const formattedMessages = chronologicalMessages
      .map((m) => `[${m.createdAt.toISOString()}] ${m.author.displayName} (@${m.author.username}): ${m.content}`)
      .join('\n');

    const systemPrompt =
      'You are a helpful assistant for the Rally chat platform. ' +
      'Summarize the following conversation concisely, highlighting key topics, ' +
      'decisions made, and any action items. Use bullet points for clarity.';

    const userMessage =
      `Please summarize the last ${messages.length} messages from the #${channel.name} channel ` +
      `in the "${channel.server.name}" server:\n\n${formattedMessages}`;

    const result = await callClaude(userId, channel.server.id, 'SUMMARY', systemPrompt, userMessage);

    res.json({
      summary: result.text,
      messageCount: messages.length,
      channelId,
      channelName: channel.name,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /welcome - Generate welcome message for a new member
// ---------------------------------------------------------------------------

router.post('/welcome', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = welcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { serverId, userId: targetUserId, interests } = parsed.data;
    const requesterId = req.user!.userId;

    // Verify the server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: {
          select: { id: true, name: true, type: true, topic: true },
          where: { type: { not: 'CATEGORY' } },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, displayName: true },
    });
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    const channelList = server.channels
      .map((c) => `#${c.name}${c.topic ? ` - ${c.topic}` : ''}`)
      .join('\n');

    const systemPrompt =
      'You are a friendly welcome bot for the Rally chat platform. ' +
      'Generate a warm, personalized welcome message for a new member. ' +
      'Include relevant channel suggestions based on their interests. ' +
      'Keep it concise but enthusiastic. Do not use excessive emojis.';

    const userMessage =
      `Generate a welcome message for ${targetUser.displayName} (@${targetUser.username}) ` +
      `who just joined the "${server.name}" server.\n\n` +
      `Their interests: ${interests.join(', ')}\n\n` +
      `Available channels:\n${channelList}`;

    const result = await callClaude(requesterId, serverId, 'WELCOME', systemPrompt, userMessage);

    res.json({
      welcomeMessage: result.text,
      serverId,
      userId: targetUserId,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /moderate - Check content for moderation
// ---------------------------------------------------------------------------

router.post('/moderate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = moderateSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { content } = parsed.data;
    const userId = req.user!.userId;

    const systemPrompt =
      'You are a content moderation system for the Rally chat platform. ' +
      'Analyze the provided content and determine if it violates community guidelines. ' +
      'Respond ONLY with valid JSON in this exact format: ' +
      '{"flagged": boolean, "reason": "string or null", "severity": "none" | "low" | "medium" | "high"}. ' +
      'Flag content that contains: hate speech, harassment, explicit content, spam, ' +
      'threats of violence, or personally identifiable information sharing. ' +
      'Do not flag content that is simply opinionated, sarcastic, or uses mild language.';

    const userMessage = `Please moderate the following content:\n\n"${content}"`;

    const result = await callClaude(userId, null, 'MODERATION', systemPrompt, userMessage);

    // Parse the AI response as JSON
    let moderationResult: { flagged: boolean; reason?: string; severity?: string };
    try {
      moderationResult = JSON.parse(result.text);
    } catch {
      // If parsing fails, default to not flagged
      moderationResult = { flagged: false, reason: undefined, severity: 'none' };
    }

    res.json({
      flagged: moderationResult.flagged,
      reason: moderationResult.reason || null,
      severity: moderationResult.severity || 'none',
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /suggest-channels - Suggest channels based on conversation
// ---------------------------------------------------------------------------

router.post('/suggest-channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = suggestChannelsSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { serverId, messageContent } = parsed.data;
    const userId = req.user!.userId;

    // Verify the server exists and get its channels
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: {
          select: { id: true, name: true, type: true, topic: true },
          where: { type: { not: 'CATEGORY' } },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    const channelList = server.channels
      .map((c) => `- #${c.name} (${c.type})${c.topic ? `: ${c.topic}` : ''}`)
      .join('\n');

    const systemPrompt =
      'You are a helpful assistant for the Rally chat platform. ' +
      'Based on a user\'s message content, suggest the most relevant channels ' +
      'from the server where this conversation would fit best. ' +
      'Respond ONLY with valid JSON in this format: ' +
      '{"suggestions": [{"channelName": "string", "reason": "string"}]}. ' +
      'Suggest 1-3 channels maximum.';

    const userMessage =
      `Based on the following message, suggest the best channels in the "${server.name}" server:\n\n` +
      `Message: "${messageContent}"\n\n` +
      `Available channels:\n${channelList}`;

    const result = await callClaude(userId, serverId, 'CHANNEL_SUGGEST', systemPrompt, userMessage);

    let suggestions: Array<{ channelName: string; reason: string }>;
    try {
      const parsed = JSON.parse(result.text);
      suggestions = parsed.suggestions || [];
    } catch {
      suggestions = [];
    }

    // Enrich suggestions with channel IDs
    const enrichedSuggestions = suggestions.map((s) => {
      const channel = server.channels.find(
        (c) => c.name.toLowerCase() === s.channelName.toLowerCase().replace(/^#/, '')
      );
      return {
        channelId: channel?.id || null,
        channelName: s.channelName,
        reason: s.reason,
      };
    });

    res.json({
      suggestions: enrichedSuggestions,
      serverId,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /report - Generate server activity report
// ---------------------------------------------------------------------------

router.post('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { serverId, days } = parsed.data;
    const userId = req.user!.userId;

    // Verify the server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: { select: { id: true, name: true } },
      },
    });
    if (!server) {
      throw new NotFoundError('Server not found');
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Aggregate message counts
    const channelIds = server.channels.map((c) => c.id);

    const totalMessages = await prisma.message.count({
      where: {
        channelId: { in: channelIds },
        createdAt: { gte: sinceDate },
      },
    });

    // Get active users (unique authors)
    const activeUsersResult = await prisma.message.groupBy({
      by: ['authorId'],
      where: {
        channelId: { in: channelIds },
        createdAt: { gte: sinceDate },
      },
    });
    const activeUserCount = activeUsersResult.length;

    // Top channels by message count
    const topChannelsResult = await prisma.message.groupBy({
      by: ['channelId'],
      where: {
        channelId: { in: channelIds },
        createdAt: { gte: sinceDate },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topChannels = topChannelsResult.map((tc) => {
      const channel = server.channels.find((c) => c.id === tc.channelId);
      return {
        channelId: tc.channelId,
        channelName: channel?.name || 'unknown',
        messageCount: tc._count.id,
      };
    });

    // Get new member count
    const newMembers = await prisma.serverMember.count({
      where: {
        serverId,
        joinedAt: { gte: sinceDate },
      },
    });

    // Get stream session count
    const streamCount = await prisma.streamSession.count({
      where: {
        serverId,
        startedAt: { gte: sinceDate },
      },
    });

    // Build the report data
    const reportData = {
      totalMessages,
      activeUsers: activeUserCount,
      newMembers,
      streamSessions: streamCount,
      topChannels,
      period: { days, since: sinceDate.toISOString() },
    };

    const systemPrompt =
      'You are an analytics assistant for the Rally chat platform. ' +
      'Generate a clear, concise activity report based on the provided server statistics. ' +
      'Highlight trends, notable activity, and suggestions for community engagement. ' +
      'Use a professional but friendly tone.';

    const userMessage =
      `Generate an activity report for the "${server.name}" server over the last ${days} days.\n\n` +
      `Statistics:\n` +
      `- Total messages: ${totalMessages}\n` +
      `- Active users: ${activeUserCount}\n` +
      `- New members: ${newMembers}\n` +
      `- Stream sessions: ${streamCount}\n` +
      `- Top channels:\n${topChannels.map((c) => `  #${c.channelName}: ${c.messageCount} messages`).join('\n')}`;

    const result = await callClaude(userId, serverId, 'REPORT', systemPrompt, userMessage);

    res.json({
      report: result.text,
      data: reportData,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /chat - General AI chat
// ---------------------------------------------------------------------------

router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      throw new BadRequestError(message);
    }

    const { message, conversationHistory } = parsed.data;
    const userId = req.user!.userId;

    const systemPrompt =
      'You are Rally AI, a helpful and knowledgeable assistant for the Rally gaming and chat platform. ' +
      'You can help users with questions about gaming, community management, platform features, ' +
      'and general topics. Be conversational, helpful, and concise. ' +
      'If asked about something you do not know, say so honestly.';

    const result = await callClaude(
      userId,
      null,
      'GENERAL',
      systemPrompt,
      message,
      conversationHistory
    );

    res.json({
      reply: result.text,
      tokensUsed: result.tokensUsed,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
