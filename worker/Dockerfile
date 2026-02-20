FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src/ ./src/

# No port exposed — this is a background worker
CMD ["node", "src/index.js"]
