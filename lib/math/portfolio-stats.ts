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
    const validItems = portfolio.filter(item => item.history && item.history.length > 5);

    if (validItems.length === 0) {
        return { annualizedReturn: 0, annualizedVolatility: 0 };
    }

    const totalWeight = validItems.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return { annualizedReturn: 0, annualizedVolatility: 0 };

    const weights = validItems.map(item => item.weight / totalWeight);

    // Find latest start date to align series
    const startDates = validItems.map(item => new Date(item.history[0].date).getTime());
    const latestStartDate = Math.max(...startDates);

    const alignedPrices: number[][] = [];
    let referenceDates: number[] = [];

    validItems.forEach((item, index) => {
        const filteredHistory = item.history.filter(h => new Date(h.date).getTime() >= latestStartDate);
        const prices = filteredHistory.map(h => h.price);

        if (index === 0) {
            referenceDates = filteredHistory.map(h => new Date(h.date).getTime());
        }

        alignedPrices.push(prices);
    });

    const minLen = Math.min(...alignedPrices.map(arr => arr.length));
    if (minLen < 2) return { annualizedReturn: 0, annualizedVolatility: 0 };

    // Truncate to minLen
    const finalPrices = alignedPrices.map(arr => arr.slice(arr.length - minLen));
    referenceDates = referenceDates.slice(referenceDates.length - minLen);

    // Calculate Time Span in Years
    const startDate = referenceDates[0];
    const endDate = referenceDates[referenceDates.length - 1];
    const timeSpanYears = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);

    // Safety check: Do not extrapolate if history is less than 6 months (0.5 years)
    // Short-term data (e.g., 1 week of +5% return) can lead to absurd annualized projections (e.g. 1100%).
    if (timeSpanYears < 0.5) {
        return { annualizedReturn: 0, annualizedVolatility: 0 };
    }

    // Calculate Average Sample Interval (dt) in years
    const N = finalPrices[0].length;
    const dt = timeSpanYears / (N - 1);
    const samplesPerYear = 1 / dt;

    // Calculate Log Returns
    const returnsMatrix = finalPrices.map(prices => calculateLogReturns(prices));

    // Mean Log Returns per step
    const meanReturns = returnsMatrix.map(returns => {
        const sum = returns.reduce((a, b) => a + b, 0);
        return sum / returns.length;
    });

    // Covariance (per step)
    const covMatrix = calculateCovarianceMatrix(returnsMatrix);

    // Expected Portfolio Return per step
    let expStepRet = 0;
    for(let i=0; i<weights.length; i++) {
        expStepRet += weights[i] * meanReturns[i];
    }

    // Expected Portfolio Variance per step
    let expStepVar = 0;
    for(let i=0; i<weights.length; i++) {
        for(let j=0; j<weights.length; j++) {
            expStepVar += weights[i] * weights[j] * covMatrix[i][j];
        }
    }

    const annLogRet = expStepRet * samplesPerYear;
    const annualizedReturn = Math.exp(annLogRet) - 1;

    const annualizedVolatility = Math.sqrt(expStepVar) * Math.sqrt(samplesPerYear);

    return { annualizedReturn, annualizedVolatility };
}
