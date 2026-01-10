import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { withAccelerate } from "@prisma/extension-accelerate";

const prismaClientSingleton = () => {
  if (process.env.DATABASE_URL?.startsWith("prisma://")) {
    const client = new PrismaClient();
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: true }
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

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
