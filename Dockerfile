# ═══════════════════════════════════════════════════════════════════════════════
# TDB Admin Panel — Multi-stage Docker Build
# ═══════════════════════════════════════════════════════════════════════════════
#
# Stage 1: Build static assets with Node 22 + Vite
# Stage 2: Serve with nginx:alpine (~25MB final image)
#
# Runtime env injection: VITE_TDB_URL is injected at container start via
# docker-entrypoint.sh → /usr/share/nginx/html/env-config.js
# The app reads window.__ENV__ at runtime (see src/config/env.ts).
#
# Build:
#   docker build -t dfrnt/tdb-admin:latest .
#
# Run:
#   docker run -p 8080:80 -e VITE_TDB_URL=http://tdb:6363 dfrnt/tdb-admin:latest
#
# ═══════════════════════════════════════════════════════════════════════════════

# ---------- Stage 1: Build ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .

# Build with a placeholder TDB URL (will be replaced at runtime)
ENV VITE_TDB_URL=__TDB_URL_PLACEHOLDER__
ENV VITE_TDB_USER=admin
RUN npm run build

# ---------- Stage 2: Serve ----------
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script (generates env-config.js at runtime)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
