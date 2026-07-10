import { describe, it, expect } from 'bun:test';

// Bulk sync is disabled (local-first, no server DB).
const { POST, GET } = await import('@/app/api/etfs/sync/all/route');

describe('Bulk Sync API (local-first)', () => {
  it('returns 501 for POST — no server DB to sync', async () => {
    const res = await POST();
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.localFirst).toBe(true);
  });

  it('returns 501 for GET', async () => {
    const res = await GET();
    expect(res.status).toBe(501);
  });
});
