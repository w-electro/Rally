# ─── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies needed for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files and install ALL dependencies (including devDependencies for build)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --legacy-peer-deps || npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ─── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files and install production dependencies only
# Note: mediasoup is excluded from Docker builds to avoid complex native dependency issues.
# WebRTC features are optional and the server handles missing mediasoup gracefully with try/catch.
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm install --omit=dev --legacy-peer-deps || npm install --production && \
    apk del python3 make g++ && \
    rm -rf /root/.npm /tmp/*

# Copy prisma directory (schema + migrations)
COPY prisma ./prisma

# Copy built JavaScript files from builder stage
COPY --from=builder /app/dist ./dist

# Copy generated Prisma client from builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create uploads directory
RUN mkdir -p /app/uploads

# Set environment
ENV NODE_ENV=production

# Expose the backend port
EXPOSE 3001

# Run database migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss && node dist/index.js"]
