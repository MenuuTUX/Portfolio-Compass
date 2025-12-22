import { describe, it, expect } from 'bun:test';

describe('API Pagination', () => {
    it('should return paginated results', async () => {
        // Fetch first page (default 50)
        const res1 = await fetch('http://localhost:3000/api/etfs/search?limit=5&includeHistory=true');
        const data1 = await res1.json();
        expect(data1.length).toBe(5);

        // Fetch second page (skip 5)
        const res2 = await fetch('http://localhost:3000/api/etfs/search?limit=5&includeHistory=true&skip=5');
        const data2 = await res2.json();
        expect(data2.length).toBe(5);

        // Ensure data is different (using ticker as ID)
        expect(data1[0].ticker).not.toBe(data2[0].ticker);
        console.log('Page 1 first ticker:', data1[0].ticker);
        console.log('Page 2 first ticker:', data2[0].ticker);
    });
});
