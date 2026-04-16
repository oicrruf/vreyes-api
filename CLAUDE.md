# vreyes-api — Project Notes for Claude

## Stack

- NestJS + TypeScript (hexagonal architecture, CQRS)
- Prisma 7 + PostgreSQL (Supabase)
- ts-node-dev for local dev

## Prisma 7 Configuration

Prisma 7 changed how database URLs are handled — **`url` in `schema.prisma` is no longer supported**.

### How it works

| Concern | Where it's configured |
|---|---|
| CLI / migrations (`prisma migrate`, `prisma generate`) | `prisma.config.ts` via `defineConfig({ datasource: { url: ... } })` |
| Runtime connection (app startup) | `PrismaService` constructor via `@prisma/adapter-pg` |

### prisma.config.ts

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["SUPABASE_DATABASE_URI"],
  },
});
```

### PrismaService

```ts
import { PrismaPg } from '@prisma/adapter-pg';

constructor() {
  super({
    adapter: new PrismaPg({ connectionString: process.env.SUPABASE_DATABASE_URI }),
  });
}
```

### schema.prisma datasource

```prisma
datasource db {
  provider = "postgresql"
  // NO url field — Prisma 7 prohibits it
}
```

## Environment Variables

- `SUPABASE_DATABASE_URI` — PostgreSQL connection string
- `FRONTEND_URL` — CORS origin (default: `http://localhost:9000`)
- `PORT` — Server port (default: `9000`)
