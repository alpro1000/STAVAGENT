FROM node:18-alpine

WORKDIR /app

# ---- Build shared TypeScript package ----
COPY stavagent-portal/shared/package*.json ./shared/
# Install all deps including devDeps (TypeScript needed for build)
RUN cd shared && npm install
COPY stavagent-portal/shared/src ./shared/src
COPY stavagent-portal/shared/tsconfig.json ./shared/
RUN cd shared && npm run build

# ---- Install backend deps ----
# package.json references "@stavagent/portal-shared": "file:../shared"
# npm ci resolves it from /app/shared/ (../shared relative to /app/backend/)
COPY stavagent-portal/backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# ---- Copy backend source ----
COPY stavagent-portal/backend/ ./backend/

# Create runtime directories
RUN mkdir -p ./backend/data ./backend/uploads ./backend/exports ./backend/logs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

WORKDIR /app/backend
CMD ["node", "server.js"]
