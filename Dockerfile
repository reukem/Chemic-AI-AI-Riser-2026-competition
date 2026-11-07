# Multi-stage build for Chemic-AI Ultimate Cloud Hosting
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runtime stage: High-performance Nginx Alpine
FROM nginx:alpine

# Copy compiled standalone distribution to web root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Standard Cloud Run / container port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
