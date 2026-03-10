FROM node:22-alpine
WORKDIR /app

COPY URS_MATCHER_SERVICE/backend/package*.json ./
RUN npm install --production
COPY URS_MATCHER_SERVICE/backend/ .

EXPOSE 3001
CMD ["node", "src/app.js"]
