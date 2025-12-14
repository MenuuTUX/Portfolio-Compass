import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { fetchISharesHoldings } from '@/lib/scrapers/ishares';
import { Decimal } from 'decimal.js';

describe('fetchISharesHoldings', () => {
    // Mock global fetch
    const mockFetch = mock((url) => {
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(`
Fund Name,iShares Core Equity ETF Portfolio
Inception Date,Aug 07 2019

Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Nominal,Price,Location,Exchange,Currency,FX Rate,Market Currency
ITOT,ISHARES CORE S&P TOTAL US STOCK,Equity,Equity,"4,792,897,978.96",45.36,"4,792,897,978.96","29,776,950",160.96,United States,NYSE Arca,USD,1.4429,USD
XIC,ISHARES S&P/TSX CAPPED COMPOSITE,Equity,Equity,"2,624,801,154.68",24.84,"2,624,801,154.68","73,938,061",35.50,Canada,Toronto Stock Exchange,CAD,1.0000,CAD
XEF,ISHARES CORE MSCI EAFE IMI ETF,Equity,Equity,"2,538,206,128.84",24.02,"2,538,206,128.84","70,388,412",36.06,Canada,Toronto Stock Exchange,CAD,1.0000,CAD
XEC,ISHARES CORE MSCI EMERGING MARKETS,Equity,Equity,"531,310,210.95",5.03,"531,310,210.95","18,340,014",28.97,Canada,Toronto Stock Exchange,CAD,1.0000,CAD
CAD,CAD CASH,Cash,Cash,"40,845,984.72",0.39,"40,845,984.72","40,845,985",100.00,Canada,-,CAD,1.0000,CAD
USD,USD CASH,Cash,Cash,"37,885,081.79",0.36,"37,885,081.79","26,256,208",100.00,United States,-,USD,1.4429,USD
            `),
        } as Response);
    });

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    it('should fetch and parse holdings correctly for a valid ticker (XEQT)', async () => {
        const holdings = await fetchISharesHoldings('XEQT');

        expect(mockFetch).toHaveBeenCalled();
        expect(holdings).toBeInstanceOf(Array);
        expect(holdings.length).toBeGreaterThan(0);

        // Check first item (ITOT)
        const itot = holdings.find(h => h.ticker === 'ITOT');
        expect(itot).toBeDefined();
        expect(itot?.name).toBe('ISHARES CORE S&P TOTAL US STOCK');
        expect(itot?.sector).toBe('Equity');
        expect(itot?.weight).toEqual(new Decimal('45.36'));
        expect(itot?.shares).toEqual(new Decimal('29776950'));

        // Check item with comma in name or other special handling if needed
        const xic = holdings.find(h => h.ticker === 'XIC');
        expect(xic).toBeDefined();
        expect(xic?.weight).toEqual(new Decimal('24.84'));
    });

    it('should throw an error for unsupported tickers', async () => {
        try {
            await fetchISharesHoldings('INVALID_TICKER');
        } catch (e: any) {
            expect(e.message).toContain('Unsupported iShares ETF ticker');
        }
    });

    it('should handle different header names if they exist in map', async () => {
         // Override mock for this test to return different headers
         mockFetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(`
Preamble stuff

Symbol,Security Name,% Net Assets,Shares
AAPL,Apple Inc.,5.5,1000
MSFT,Microsoft Corp,4.2,800
            `),
        } as Response));

        const holdings = await fetchISharesHoldings('XIC'); // Use XIC to pass lookup check

        expect(holdings.length).toBe(2);
        expect(holdings[0].ticker).toBe('AAPL');
        expect(holdings[0].weight).toEqual(new Decimal('5.5'));
        expect(holdings[0].shares).toEqual(new Decimal('1000'));
    });
});
