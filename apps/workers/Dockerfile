FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/types/package.json ./packages/types/
COPY packages/database/package.json ./packages/database/
COPY packages/llm/package.json ./packages/llm/
COPY packages/agent-sdk/package.json ./packages/agent-sdk/
COPY packages/agent-registry/package.json ./packages/agent-registry/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
COPY packages/event-bus/package.json ./packages/event-bus/
COPY packages/tool-registry/package.json ./packages/tool-registry/
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
RUN npm run build --workspace=@agent-all/tool-registry
RUN npm run build --workspace=@agent-all/workers

FROM base AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/apps/workers/package.json ./apps/workers/
WORKDIR /app/apps/workers
CMD ["node", "dist/main.js"]
