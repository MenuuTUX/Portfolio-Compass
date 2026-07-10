import { describe, it, expect, mock } from 'bun:test';
import { mockModule } from '@/tests/helpers/mock-module';

// Mock NextResponse
await mockModule('next/server', () => ({
    NextResponse: {
        json: (body: any, options?: any) => ({ body, status: options?.status || 200 })
    }
}));

// Import after mocks
const { GET } = await import('@/app/api/portfolio/route');

describe('Portfolio API', () => {
    it('returns 501 local-first response (no login / cloud portfolio)', async () => {
        const response = (await GET()) as any;

        expect(response.status).toBe(501);
        expect(response.body.localFirst).toBe(true);
        expect(response.body.error).toBe('Portfolio is local-first');
        expect(typeof response.body.message).toBe('string');
    });
});
