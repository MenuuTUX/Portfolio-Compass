import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    queue: {
        concurrency: 4,
        timeout: 60000
    },
    logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
    }
});

async function main() {
    const ticker = 'VEQT.TO';
    try {
        console.log("Fetching for " + ticker);
        const quoteSummary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryProfile'] } as any);
        console.log('SummaryProfile:', JSON.stringify(quoteSummary.summaryProfile, null, 2));
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
