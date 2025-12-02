import yahooFinance from 'yahoo-finance2';

async function test() {
    try {
        console.log("Testing yahooFinance.quoteSummary...");
        const res = await yahooFinance.quoteSummary('AAPL', { modules: ['price'] });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
