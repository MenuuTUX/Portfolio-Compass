import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { withAccelerate } from '@prisma/extension-accelerate'

const prismaClientSingleton = () => {
  // Ensure we have a connection string.
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  const connectionString = process.env.DATABASE_URL;

  // Check if using Prisma Accelerate (prisma:// or prisma+postgres://)
  if (connectionString.startsWith('prisma://') || connectionString.startsWith('prisma+postgres://')) {
    return new PrismaClient().$extends(withAccelerate())
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
  const adapter = new PrismaPg(pool)

  // Return the standard client but cast it to the Extended client type
  // to ensure a consistent return type for the singleton and avoid union type issues in the app.
  // The Extended client is a superset of the standard client functionality-wise for our usage.
  const client = new PrismaClient({ adapter });
  return client as unknown as ReturnType<typeof createExtendedClient>;
};

// Helper to infer the extended client type
function createExtendedClient() {
  return new PrismaClient().$extends(withAccelerate());
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_TEST_CONTEXT !== 'true') {
  if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
}
