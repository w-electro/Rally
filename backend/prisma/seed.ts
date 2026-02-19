import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 12);

  const user1 = await prisma.user.upsert({
    where: { email: 'phoenix@rally.gg' },
    update: {},
    create: {
      email: 'phoenix@rally.gg',
      username: 'PhoenixRider',
      displayName: 'Phoenix Rider',
      passwordHash,
      bio: 'Rally platform founder. Gaming enthusiast.',
      status: 'ONLINE',
      gamingStats: { gamesPlayed: ['Valorant', 'Apex Legends', 'CS2'], achievements: [], hours: { Valorant: 1200, 'Apex Legends': 800 } },
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'nova@rally.gg' },
    update: {},
    create: {
      email: 'nova@rally.gg',
      username: 'NovaBlade',
      displayName: 'Nova Blade',
      passwordHash,
      bio: 'Competitive FPS player. Stream on Rally!',
      status: 'ONLINE',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'shadow@rally.gg' },
    update: {},
    create: {
      email: 'shadow@rally.gg',
      username: 'ShadowStrike',
      displayName: 'Shadow Strike',
      passwordHash,
      bio: 'Content creator and esports commentator',
      status: 'IDLE',
    },
  });

  // Create a demo server
  const server = await prisma.server.upsert({
    where: { vanityUrl: 'rally-hq' },
    update: {},
    create: {
      name: 'Rally HQ',
      description: 'Official Rally community server - Welcome to the future of gaming communication!',
      ownerId: user1.id,
      isPublic: true,
      vanityUrl: 'rally-hq',
      features: ['FEED', 'STORIES', 'POINTS', 'AI_ASSISTANT', 'COMMERCE'],
    },
  });

  // Create default role
  const defaultRole = await prisma.role.upsert({
    where: { id: 'default-role-' + server.id },
    update: {},
    create: {
      id: 'default-role-' + server.id,
      serverId: server.id,
      name: '@everyone',
      color: '#99AAB5',
      position: 0,
      permissions: BigInt(0x7FF), // basic permissions
      isDefault: true,
    },
  });

  // Create channels
  const generalCategory = await prisma.channel.create({
    data: { serverId: server.id, name: 'General', type: 'CATEGORY', position: 0 },
  });

  const welcomeChannel = await prisma.channel.create({
    data: { serverId: server.id, name: 'welcome', type: 'TEXT', position: 1, parentId: generalCategory.id, topic: 'Welcome to Rally HQ! Introduce yourself here.' },
  });

  const generalChat = await prisma.channel.create({
    data: { serverId: server.id, name: 'general-chat', type: 'TEXT', position: 2, parentId: generalCategory.id },
  });

  const feedChannel = await prisma.channel.create({
    data: { serverId: server.id, name: 'screenshots', type: 'FEED', position: 3, parentId: generalCategory.id, topic: 'Share your best gaming moments!' },
  });

  const voiceCategory = await prisma.channel.create({
    data: { serverId: server.id, name: 'Voice Channels', type: 'CATEGORY', position: 4 },
  });

  await prisma.channel.createMany({
    data: [
      { serverId: server.id, name: 'Lobby', type: 'VOICE', position: 5, parentId: voiceCategory.id },
      { serverId: server.id, name: 'Gaming', type: 'VOICE', position: 6, parentId: voiceCategory.id },
      { serverId: server.id, name: 'Streaming', type: 'VOICE', position: 7, parentId: voiceCategory.id },
    ],
  });

  // Add members
  for (const user of [user1, user2, user3]) {
    await prisma.serverMember.upsert({
      where: { userId_serverId: { userId: user.id, serverId: server.id } },
      update: {},
      create: { userId: user.id, serverId: server.id },
    });
  }

  // Add some demo messages
  await prisma.message.createMany({
    data: [
      { channelId: welcomeChannel.id, authorId: user1.id, content: 'Welcome to Rally HQ! This is the future of gaming communication. 🎮', type: 'SYSTEM' },
      { channelId: generalChat.id, authorId: user1.id, content: 'Hey everyone! The Rally platform is live. Let me know what you think!' },
      { channelId: generalChat.id, authorId: user2.id, content: 'This is amazing! The feed channels are exactly what I needed for sharing clips.' },
      { channelId: generalChat.id, authorId: user3.id, content: 'Channel points system is addictive. Already earned 500 points from chatting!' },
      { channelId: generalChat.id, authorId: user1.id, content: 'Wait until you try the AI assistant - it can summarize entire conversations you missed!' },
    ],
  });

  // Create some Pulse posts
  await prisma.pulsePost.createMany({
    data: [
      { authorId: user1.id, content: 'Rally is officially LIVE! The next generation of gaming communication is here. #RallyLaunch #Gaming #NewEra', hashtags: ['RallyLaunch', 'Gaming', 'NewEra'], viralScore: 95.5 },
      { authorId: user2.id, content: 'Just hit Immortal rank in Valorant while streaming on Rally. The integrated streaming is insane! #Valorant #Rally #Streaming', hashtags: ['Valorant', 'Rally', 'Streaming'], viralScore: 42.3 },
      { authorId: user3.id, content: 'The Channel Points system on Rally is next level. Watching streams and earning rewards? Sign me up! #ChannelPoints #Esports', hashtags: ['ChannelPoints', 'Esports'], viralScore: 28.7 },
    ],
  });

  // Create trending hashtags
  await prisma.trendingHashtag.createMany({
    data: [
      { tag: 'RallyLaunch', postCount: 1523, score: 98.2 },
      { tag: 'Gaming', postCount: 45210, score: 85.1 },
      { tag: 'Esports', postCount: 12840, score: 72.4 },
      { tag: 'Streaming', postCount: 8920, score: 61.3 },
      { tag: 'Valorant', postCount: 34100, score: 55.8 },
    ],
  });

  // Configure AI for the server
  await prisma.aiServerConfig.upsert({
    where: { serverId: server.id },
    update: {},
    create: {
      serverId: server.id,
      isEnabled: true,
      personality: 'You are Rally Bot, the AI assistant for Rally HQ. You are energetic, gaming-savvy, and use esports terminology naturally. Keep responses concise and helpful.',
      welcomeMsg: true,
      autoModerate: true,
      summarize: true,
      answerFaq: true,
    },
  });

  // Create point rewards
  await prisma.pointReward.createMany({
    data: [
      { serverId: server.id, title: 'VIP Badge', description: 'Get a special VIP badge next to your name', cost: 5000, isEnabled: true },
      { serverId: server.id, title: 'Custom Emoji', description: 'Add a custom emoji to the server', cost: 10000, isEnabled: true },
      { serverId: server.id, title: 'Highlight Message', description: 'Your next message will be highlighted in chat', cost: 500, isEnabled: true },
      { serverId: server.id, title: 'Song Request', description: 'Request a song during the next stream', cost: 2000, isEnabled: true, maxPerStream: 3 },
    ],
  });

  console.log('Database seeded successfully!');
  console.log(`Created ${3} users, ${1} server, ${8} channels, ${5} messages`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
