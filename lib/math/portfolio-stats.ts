import { Portfolio } from '@/types';
import { calculateLogReturns, calculateCovarianceMatrix } from '@/lib/monte-carlo';

/**
 * Calculates historical portfolio statistics (Annualized Return, Annualized Volatility)
 * based on the provided portfolio items' history.
 *
 * @param portfolio The portfolio with `history` property populated.
 * @param riskFreeRate The risk free rate (default 0.04)
 * @returns Object with annualizedReturn and annualizedVolatility
 */
export function calculatePortfolioHistoricalStats(portfolio: Portfolio, riskFreeRate: number = 0.04): { annualizedReturn: number, annualizedVolatility: number } {
    // Filter items with sufficient history
    const validItems = portfolio.filter(item => item.history && item.history.length > 30);

    if (validItems.length === 0) {
        return { annualizedReturn: 0, annualizedVolatility: 0 };
    }

    const totalWeight = validItems.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return { annualizedReturn: 0, annualizedVolatility: 0 };

    const weights = validItems.map(item => item.weight / totalWeight);

    // Align Dates (Simplified alignment: take intersection of last N days, or just assume aligned if fetched via batch)
    // For robust calc, we find the common date range.
    // Assuming history is sorted ascending.

    // Find latest start date
    const startDates = validItems.map(item => new Date(item.history[0].date).getTime());
    const latestStartDate = Math.max(...startDates);

    const alignedPrices: number[][] = [];
    validItems.forEach(item => {
        const filtered = item.history.filter(h => new Date(h.date).getTime() >= latestStartDate);
        alignedPrices.push(filtered.map(h => h.price));
    });

    const minLen = Math.min(...alignedPrices.map(arr => arr.length));
    if (minLen < 2) return { annualizedReturn: 0, annualizedVolatility: 0 };

    const finalPrices = alignedPrices.map(arr => arr.slice(arr.length - minLen));

    // Calculate Returns
    const returnsMatrix = finalPrices.map(prices => calculateLogReturns(prices));

    // Mean Returns (Daily)
    const meanReturns = returnsMatrix.map(returns => {
        const sum = returns.reduce((a, b) => a + b, 0);
        return sum / returns.length;
    });

    // Covariance
    const covMatrix = calculateCovarianceMatrix(returnsMatrix);

    // Expected Daily Return = w * mu
    let expDailyRet = 0;
    for(let i=0; i<weights.length; i++) expDailyRet += weights[i] * meanReturns[i];

    // Expected Daily Variance = w^T * Cov * w
    let expDailyVar = 0;
    for(let i=0; i<weights.length; i++) {
        for(let j=0; j<weights.length; j++) {
            expDailyVar += weights[i] * weights[j] * covMatrix[i][j];
        }
    }

    const annRet = expDailyRet * 252;
    const annVol = Math.sqrt(expDailyVar) * Math.sqrt(252);

    return { annualizedReturn: annRet, annualizedVolatility: annVol };
}
