# Stage 1: Build Angular static files
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine
# Copy built files
COPY --from=builder /app/dist/frontend/browser/ /usr/share/nginx/html/
# Copy template and runner scripts (now at root level of repository)
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8080
CMD ["/run.sh"]
