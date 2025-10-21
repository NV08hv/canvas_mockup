# Multi-stage build for frontend optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Install only essential build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --silent

# Copy source code
COPY . .

# Accept build arguments for environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache wget

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install all dependencies (vite is needed for preview server)
RUN npm ci --silent && npm cache clean --force

# Expose port 5173
EXPOSE 5173

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# Run preview server on port 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
