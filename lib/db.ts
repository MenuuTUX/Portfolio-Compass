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

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        max: 1, // Reduced to 1 to prevent "MaxClientsInSessionMode" errors in serverless/Supabase environments
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 20000, // Increased timeout to wait for connections
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
