import { Portfolio } from '@/types';
import { calculateLogReturns, calculateCovarianceMatrix } from '@/lib/monte-carlo';
import { alignPriceHistory } from '@/lib/finance';

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

    // Use robust alignment
    const historicalDataInputs = validItems.map(item => item.history || []);
    const finalPrices = alignPriceHistory(historicalDataInputs);

    if (finalPrices.length === 0 || finalPrices[0].length < 2) {
        return { annualizedReturn: 0, annualizedVolatility: 0 };
    }

    // We need to approximate timeSpanYears.
    // alignPriceHistory aligns to the date set.
    // We can infer the span from the number of samples if we assume daily trading (252 days/year).
    // Or better, we should probably return dates from alignPriceHistory too?
    // The previous implementation used referenceDates from the first item.
    // Let's assume typical daily data for now: samples / 252.
    // BUT, the previous code calculated exact time span from dates.

    // To be precise without changing alignPriceHistory signature too much,
    // we can re-derive the span from the inputs and the fact that we aligned them.
    // Or we can just use the "N samples / 252" approximation which is standard for annualized vol.
    // Annualized Vol = Daily Vol * sqrt(252).
    // Annualized Return = Daily Return * 252.

    // However, the existing code calculates `dt` and `samplesPerYear`.
    // Let's look at how it did it:
    // const timeSpanYears = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);
    // const dt = timeSpanYears / (N - 1);
    // const samplesPerYear = 1 / dt;

    // If we assume daily data (which is what we have), samplesPerYear is approx 252.
    // Let's stick to the standard 252 for simplicity and robustness,
    // rather than relying on exact timestamps which might have gaps (weekends) that skew "dt" if we treat it as continuous time.
    // Actually, finance usually treats "trading days" as the unit of time, so dt = 1/252.

    const samplesPerYear = 252;
    const N = finalPrices[0].length;

    // Safety check: Do not extrapolate if history is less than 6 months (approx 126 trading days)
    if (N < 126) {
        return { annualizedReturn: 0, annualizedVolatility: 0 };
    }

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
