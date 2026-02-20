FROM node:20-alpine AS base
WORKDIR /app

# Install ALL dependencies (including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage — only runtime deps
FROM node:20-alpine AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy Prisma schema and generate client for production
COPY --from=base /app/prisma ./prisma
RUN npx prisma generate

# Copy compiled code
COPY --from=base /app/dist ./dist

# Run migrations and start
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
