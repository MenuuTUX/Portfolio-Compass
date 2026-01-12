import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test';
import { POST } from '@/app/api/etfs/sync/all/route';

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

mock.module('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: any, init?: any) => ({
      json: async () => body,
      status: init?.status || 200,
    }),
  },
}));

// We need a mock request that behaves like NextRequest but works in this test env.
const createMockRequest = (headers: Record<string, string> = {}) => {
  // Normalize headers to lowercase keys for case-insensitive lookup
  const normalizedHeaders = Object.keys(headers).reduce((acc, key) => {
    acc[key.toLowerCase()] = headers[key];
    return acc;
  }, {} as Record<string, string>);

  return {
    headers: {
      get: (key: string) => normalizedHeaders[key.toLowerCase()] || null,
    },
    json: async () => ({}),
  } as any;
};

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

    const req = createMockRequest({});
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 if Authorization header is incorrect', async () => {
    process.env.CRON_SECRET = 'supersecret';
    process.env.NODE_ENV = 'production';

    const req = createMockRequest({
        'Authorization': 'Bearer wrongsecret',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 500 if CRON_SECRET is missing in production', async () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'production';

    const req = createMockRequest({});
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Server Configuration Error');
  });

  it('should allow access if headers match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'supersecret';
    process.env.NODE_ENV = 'production';

    const req = createMockRequest({
        'Authorization': 'Bearer supersecret',
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

    const req = createMockRequest({});
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();

    console.warn = originalWarn;
  });
});
