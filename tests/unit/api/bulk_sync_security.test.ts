import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test';
import { POST } from '@/app/api/etfs/sync/all/route';
import { NextRequest } from 'next/server';

// Mock dependencies
mock.module('@/lib/db', () => ({
  default: {
    etf: {
      findMany: mock(async () => []),
    },
  },
}));

mock.module('@/lib/etf-sync', () => ({
  syncEtfDetails: mock(async () => ({})),
}));

describe('Bulk Sync API Security', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return 401 if CRON_SECRET is set but header is missing', async () => {
    process.env.CRON_SECRET = 'supersecret';
    process.env.NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/etfs/sync/all', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 if Authorization header is incorrect', async () => {
    process.env.CRON_SECRET = 'supersecret';
    process.env.NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/etfs/sync/all', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrongsecret',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 500 if CRON_SECRET is missing in production', async () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/etfs/sync/all', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Server Configuration Error: Missing CRON_SECRET');
  });

  it('should allow access if headers match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'supersecret';
    process.env.NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/etfs/sync/all', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer supersecret',
      },
    });

    const res = await POST(req);
    // Since we mocked DB to return empty, it should be 200 with "No ETFs to sync"
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('No ETFs to sync');
  });

  it('should warn but allow access in development if CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'development';

    // Spy on console.warn
    const warnSpy = mock();
    const originalWarn = console.warn;
    console.warn = warnSpy;

    const req = new NextRequest('http://localhost/api/etfs/sync/all', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();

    console.warn = originalWarn;
  });
});
