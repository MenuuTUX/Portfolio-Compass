// The Prisma CLI evaluates this file without loading .env; dotenv makes
// `prisma generate/db push/studio` work outside of bun/next contexts.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "bun run scripts/seed_market.ts",
  },
});
