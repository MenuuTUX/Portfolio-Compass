
import { describe, it, expect } from 'bun:test';
import { alignPriceHistory } from '@/lib/finance'; // Will implement this next

describe('Data Alignment', () => {
    it('aligns price histories with different dates (holidays)', () => {
        // Asset A: US Stock (Closed on July 4th)
        // Asset B: Canadian Stock (Open on July 4th, Closed on July 1st)

        // Let's simulate a week: July 1 to July 5
        // July 1 (Canada Day): A trades, B closed
        // July 2: Both trade
        // July 3: Both trade
        // July 4 (Independence Day): A closed, B trades
        // July 5: Both trade

        const historyA = [
            { date: '2023-07-01', price: 100 }, // A open
            { date: '2023-07-02', price: 101 },
            { date: '2023-07-03', price: 102 },
            // July 4 missing
            { date: '2023-07-05', price: 103 },
        ];

        const historyB = [
            // July 1 missing
            { date: '2023-07-02', price: 50 },
            { date: '2023-07-03', price: 51 },
            { date: '2023-07-04', price: 52 }, // B open
            { date: '2023-07-05', price: 53 },
        ];

        const inputs = [historyA, historyB];

        // Expected behavior:
        // Union of dates: July 1, 2, 3, 4, 5
        // Since B starts on July 2, we might cut off July 1 if we use "max(startDates)".
        // max(startDates) = July 2.
        // So we filter >= July 2.
        // Dates: July 2, 3, 4, 5.

        // A on July 2: 101
        // B on July 2: 50

        // A on July 3: 102
        // B on July 3: 51

        // A on July 4: Missing -> Forward fill from July 3 -> 102
        // B on July 4: 52

        // A on July 5: 103
        // B on July 5: 53

        // Result A: [101, 102, 102, 103]
        // Result B: [50, 51, 52, 53]

        const aligned = alignPriceHistory(inputs);

        expect(aligned.length).toBe(2);
        expect(aligned[0].length).toBe(4);
        expect(aligned[1].length).toBe(4);

        // Check A
        expect(aligned[0]).toEqual([101, 102, 102, 103]);

        // Check B
        expect(aligned[1]).toEqual([50, 51, 52, 53]);
    });

    it('handles gap at the start', () => {
         const historyA = [
            { date: '2023-01-01', price: 10 },
            { date: '2023-01-02', price: 11 },
            { date: '2023-01-03', price: 12 },
        ];

        const historyB = [
            { date: '2023-01-03', price: 20 },
            { date: '2023-01-04', price: 21 },
        ];

        // Max start date is 2023-01-03.
        // Range: 2023-01-03 onwards.
        // But historyA ends at 03.
        // historyB starts at 03.

        // Dates >= 2023-01-03: 03, 04

        // A at 03: 12
        // B at 03: 20

        // A at 04: Missing (end of data). Should we forward fill?
        // Yes, if the dataset "continues" for other assets.
        // A at 04 -> 12
        // B at 04 -> 21

        const inputs = [historyA, historyB];
        const aligned = alignPriceHistory(inputs);

        expect(aligned[0]).toEqual([12, 12]);
        expect(aligned[1]).toEqual([20, 21]);
    });
});
