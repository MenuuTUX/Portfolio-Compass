import { fetchSectorWeightings } from './lib/sector-utils';

async function test() {
    try {
        console.log("Fetching sector weightings for SPY...");
        const sectors = await fetchSectorWeightings('SPY');
        console.log("Sectors:", sectors);
        if (sectors.length > 0) {
            console.log("SUCCESS: Fetched sectors.");
        } else {
            console.log("WARNING: No sectors fetched (might be expected if API fails or no data).");
        }
    } catch (e) {
        console.error("ERROR:", e);
        process.exit(1);
    }
}

test();
