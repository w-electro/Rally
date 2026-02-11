import path from "path";

const config = {
  /** Server port */
  port: parseInt(process.env.PORT || "3001", 10),

  /** PostgreSQL connection string */
  databaseUrl: process.env.DATABASE_URL || "postgresql://localhost:5432/rally",

  /** Redis connection URL */
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  /** JWT signing secret for access tokens */
  jwtSecret: process.env.JWT_SECRET || "rally-dev-secret",

  /** JWT signing secret for refresh tokens */
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "rally-dev-refresh-secret",

  /** Access token expiry duration */
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",

  /** Refresh token expiry duration */
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",

  /** Allowed CORS origin */
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  /** Directory for uploaded files */
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads"),

  /** Maximum file upload size in bytes (default 100MB) */
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(100 * 1024 * 1024), 10),

  /** Mediasoup listen IP address */
  mediasoupListenIp: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",

  /** Mediasoup announced IP (public-facing IP) */
  mediasoupAnnouncedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",

  /** Node environment */
  nodeEnv: process.env.NODE_ENV || "development",

  /** Whether we are in production */
  isProduction: process.env.NODE_ENV === "production",

  /** SMTP configuration for email */
  smtp: {
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "noreply@rally.dev",
  },
} as const;

export default config;
