import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
  // Ensure we have a connection string.
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  const connectionString = process.env.DATABASE_URL;

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Limit connection pool for serverless environments to prevent "MaxClientsInSessionMode"
    max: process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS) : 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_TEST_CONTEXT !== 'true') {
  if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
}
