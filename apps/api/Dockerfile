FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/workers/package.json ./apps/workers/
COPY packages/types/package.json ./packages/types/
COPY packages/database/package.json ./packages/database/
COPY packages/llm/package.json ./packages/llm/
COPY packages/agent-sdk/package.json ./packages/agent-sdk/
COPY packages/agent-registry/package.json ./packages/agent-registry/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
COPY packages/event-bus/package.json ./packages/event-bus/
COPY packages/rag/package.json ./packages/rag/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/ ./
COPY . .
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=packages/llm
RUN npm run build --workspace=packages/agent-sdk
RUN npm run build --workspace=packages/agent-registry
RUN npm run build --workspace=packages/workflow-engine
RUN npm run build --workspace=packages/event-bus
RUN npm run build --workspace=packages/rag
RUN npm run build --workspace=@agent-all/api

FROM base AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
