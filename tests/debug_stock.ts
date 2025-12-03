import { fetchSectorWeightings } from '../lib/sector-utils';
import fs from 'fs';

async function debugStock() {
    try {
        const ticker = 'TSLA';
        console.log(`Fetching data for ${ticker}...`);

        const sectors = await fetchSectorWeightings(ticker);

        console.log("Sectors:", JSON.stringify(sectors, null, 2));
        fs.writeFileSync('debug_output.json', JSON.stringify(sectors, null, 2));

    } catch (e) {
        console.error("Error:", e);
        fs.writeFileSync('debug_output.json', JSON.stringify({ error: (e as Error).message }, null, 2));
    }
}

debugStock();
