FROM node:20-alpine

WORKDIR /app

# ---- Build shared TypeScript package ----
# Context root = Zeleznice-Planner/
COPY shared/package*.json ./shared/
RUN cd shared && npm install
COPY shared/src ./shared/src
COPY shared/tsconfig.json ./shared/
RUN cd shared && npm run build

# ---- Install backend deps ----
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# ---- Copy backend source ----
COPY backend/ ./backend/

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

WORKDIR /app/backend
CMD ["node", "server.js"]
