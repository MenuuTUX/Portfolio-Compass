import yahooFinance from 'yahoo-finance2';
import fs from 'fs';

async function debugStock() {
    try {
        const ticker = 'TSLA';
        console.log(`Fetching data for ${ticker}...`);

        const yf = new yahooFinance();

        const result = await yf.quoteSummary(ticker, {
            modules: ['summaryProfile', 'fundProfile', 'price', 'defaultKeyStatistics']
        });

        const output = {
            summaryProfile: result.summaryProfile,
            fundProfile: result.fundProfile,
            sector: result.summaryProfile?.sector
        };

        fs.writeFileSync('debug_output.json', JSON.stringify(output, null, 2));
        console.log("Wrote output to debug_output.json");

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('debug_output.json', JSON.stringify({ error: e.message }, null, 2));
    }
}

debugStock();
