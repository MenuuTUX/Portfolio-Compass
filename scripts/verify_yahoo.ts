import yf from 'yahoo-finance2';

yf.suppressNotices(['yahooSurvey']);

async function check(ticker: string) {
    console.log(`Checking ${ticker}...`);
    try {
        const quote = await yf.quote(ticker);
        console.log(`[${ticker}] quote:`);
        console.log(`  shortName: ${quote.shortName}`);
        console.log(`  longName: ${quote.longName}`);
        console.log(`  symbol: ${quote.symbol}`);
        console.log(`  quoteType: ${quote.quoteType}`);

        const summary = await yf.quoteSummary(ticker, { modules: ['price'] });
        console.log(`[${ticker}] quoteSummary.price:`);
        console.log(`  shortName: ${summary.price?.shortName}`);
        console.log(`  longName: ${summary.price?.longName}`);

    } catch (e) {
        console.error(e);
    }
}

async function main() {
    await check('ACWI');
    await check('AGG');
}

main();
