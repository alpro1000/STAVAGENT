FROM node:22-alpine
WORKDIR /app

# Copy shared package first
COPY ../shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# Copy backend
WORKDIR /app/backend
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
