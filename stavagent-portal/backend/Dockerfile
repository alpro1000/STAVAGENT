FROM node:18-alpine
WORKDIR /app

# Copy shared package
COPY stavagent-portal/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# Copy backend
WORKDIR /app/backend
COPY stavagent-portal/backend/package*.json ./
RUN npm install --production
COPY stavagent-portal/backend/ .

EXPOSE 3001
CMD ["node", "server.js"]
