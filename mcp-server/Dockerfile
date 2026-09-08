FROM node:22-slim
WORKDIR /app/mcp-server

COPY mcp-server/package.json mcp-server/pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile

COPY mcp-server/tsconfig.json ./tsconfig.json
COPY mcp-server/src ./src
COPY src/types/database.types.ts /app/src/types/database.types.ts
RUN pnpm exec tsc -b

EXPOSE 3100
CMD ["node", "dist/mcp-server/src/index.js"]
