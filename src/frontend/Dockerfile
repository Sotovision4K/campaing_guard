# Development image for the Profasee frontend.
# Runs Vite's dev server with HMR. Source is mounted as a volume so edits on
# the host are picked up by Vite's in-memory watcher (no rebuild needed).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Vite dev server + HMR WebSocket
EXPOSE 5173

# Allow the Vite dev server to listen on 0.0.0.0 (default is localhost)
ENV HOST=0.0.0.0

CMD ["npm", "run", "dev"]
