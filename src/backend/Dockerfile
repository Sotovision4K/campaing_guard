# Development image for the Profasee backend.
# Single-stage, no build step. Source is mounted as a volume so tsx watch picks
# up changes on the host and the container auto-reloads.
FROM node:20-alpine

WORKDIR /app

# Install deps (including devDependencies: tsx, typescript, vitest, pino-pretty)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Source code is mounted at runtime via docker-compose; copy as a fallback
COPY tsconfig.json ./
COPY src ./src

# API + Node inspector (for attaching VS Code / Chrome DevTools)
EXPOSE 8080 9229

# tsx watch restarts on any file change; --inspect exposes the V8 inspector
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/app.ts"]
