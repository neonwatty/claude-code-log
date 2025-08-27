# Multi-stage Dockerfile for production deployment
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Development stage
FROM base AS development
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3001 5173
CMD ["dumb-init", "npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies (including dev dependencies for building)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build
RUN npm run test:prod

# Production stage
FROM node:18-alpine AS production

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Create app directory
WORKDIR /app

# Copy production dependencies
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/package*.json ./

# Copy necessary config files
COPY --from=build /app/.env.production ./.env
COPY --from=build /app/backend/tsconfig.json ./backend/
COPY --from=build /app/frontend/index.html ./frontend/

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]