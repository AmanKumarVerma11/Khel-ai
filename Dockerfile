# Multi-stage build for backend
FROM node:18-alpine AS backend

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./

EXPOSE 5000

CMD ["npm", "start"]