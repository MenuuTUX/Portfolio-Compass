import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { withAccelerate } from '@prisma/extension-accelerate'

const prismaClientSingleton = () => {
    // If using Accelerate (prisma://)
    if (process.env.DATABASE_URL?.startsWith('prisma://')) {
        const client = new PrismaClient();
        return client.$extends(withAccelerate()) as unknown as PrismaClient;
    }

    // Standard Postgres usage requires Adapter in Prisma 7 with prisma.config.ts
    // We strictly require DATABASE_URL in production.
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined in environment variables");
    }

    // Optimization for Serverless (Vercel/Neon):
    // Reduce max connections to avoid "MaxClientsInSessionMode" or "too many clients" errors.
    // Serverless functions spin up many instances; if each takes 5 connections, we hit limits fast.
    // SECURITY: In production, ensure DATABASE_URL points to the Transaction Pooler (Supabase port 6543)
    // to manage thousands of short-lived connections effectively.
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        max: 3, // Keep low (1-3) for serverless environments
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 10000,
    });

    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    return client;
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
