import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Unit tests mock all database access; provide a placeholder so modules that
// validate DATABASE_URL at import time can load without a local .env.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';

GlobalRegistrator.register();
