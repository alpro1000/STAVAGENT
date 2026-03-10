FROM node:22-alpine
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

EXPOSE 3001
CMD ["node", "server.js"]
