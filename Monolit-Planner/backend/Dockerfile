FROM node:22-alpine

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy shared package
COPY Monolit-Planner/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# Copy backend
WORKDIR /app/backend
COPY Monolit-Planner/backend/package*.json ./
RUN npm install --production
COPY Monolit-Planner/backend/ .

# Copy OTSKP catalog XML for auto-import at startup
COPY "Monolit-Planner/2025_03 OTSKP.xml" /app/2025_03\ OTSKP.xml

EXPOSE 3001
CMD ["node", "server.js"]
