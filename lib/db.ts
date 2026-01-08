import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { withAccelerate } from "@prisma/extension-accelerate";

const prismaClientSingleton = () => {
  if (process.env.DATABASE_URL?.startsWith("prisma://")) {
    const client = new PrismaClient();
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }

  // Fallback for build time / when ENV is missing
  const url = process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/portfolio_compass";

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
