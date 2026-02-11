import { PrismaClient, ChannelType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Rally database...");

  // Create test admin user
  const passwordHash = await bcrypt.hash("admin123", 12);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@rally.dev",
      discriminator: "0001",
      password: passwordHash,
      about: "Rally platform administrator",
      status: "online",
    },
  });

  console.log(`Created admin user: ${adminUser.username}#${adminUser.discriminator} (${adminUser.id})`);

  // Create the Rally HQ server
  const rallyHQ = await prisma.server.upsert({
    where: { id: adminUser.id },
    update: {},
    create: {
      name: "Rally HQ",
      description: "The official Rally community server. Welcome to the future of communication!",
      ownerId: adminUser.id,
      isPublic: true,
    },
  });

  console.log(`Created server: ${rallyHQ.name} (${rallyHQ.id})`);

  // Create the @everyone default role for the server
  const everyoneRole = await prisma.role.upsert({
    where: { id: rallyHQ.id },
    update: {},
    create: {
      name: "@everyone",
      serverId: rallyHQ.id,
      permissions: BigInt(0x0000000000000040) | BigInt(0x0000000000000800) | BigInt(0x0000000000001000),
      // SEND_MESSAGES | CONNECT_VOICE | SPEAK
      position: 0,
      isDefault: true,
      color: "#99AAB5",
    },
  });

  console.log(`Created default role: ${everyoneRole.name}`);

  // Add admin as a server member
  const adminMember = await prisma.serverMember.upsert({
    where: {
      userId_serverId: {
        userId: adminUser.id,
        serverId: rallyHQ.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      serverId: rallyHQ.id,
    },
  });

  console.log(`Added ${adminUser.username} as member of ${rallyHQ.name}`);

  // Create general text channel
  const generalChannel = await prisma.channel.create({
    data: {
      name: "general",
      topic: "General discussion for Rally HQ",
      type: ChannelType.TEXT,
      serverId: rallyHQ.id,
      position: 0,
    },
  });

  console.log(`Created text channel: #${generalChannel.name}`);

  // Create voice channel
  const voiceChannel = await prisma.channel.create({
    data: {
      name: "General Voice",
      topic: "Hang out and chat with voice",
      type: ChannelType.VOICE,
      serverId: rallyHQ.id,
      position: 1,
    },
  });

  console.log(`Created voice channel: ${voiceChannel.name}`);

  // Create a welcome message in general
  const welcomeMessage = await prisma.message.create({
    data: {
      content:
        "Welcome to **Rally HQ**! This is the official community server for Rally, the next-generation communication platform. Feel free to chat, share ideas, and connect with others. We're glad to have you here!",
      authorId: adminUser.id,
      channelId: generalChannel.id,
      attachments: [],
      embeds: [],
    },
  });

  console.log(`Created welcome message (${welcomeMessage.id})`);

  // Create a default invite code for the server
  const invite = await prisma.invite.create({
    data: {
      code: "rally-hq",
      serverId: rallyHQ.id,
      creatorId: adminUser.id,
      maxUses: 0, // unlimited
    },
  });

  console.log(`Created invite code: ${invite.code}`);

  console.log("\nSeed completed successfully!");
  console.log("─────────────────────────────────────────");
  console.log("Test credentials:");
  console.log("  Username: admin");
  console.log("  Password: admin123");
  console.log("  Server:   Rally HQ");
  console.log("  Invite:   rally-hq");
  console.log("─────────────────────────────────────────");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
