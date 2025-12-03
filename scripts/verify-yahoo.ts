import { fetchMarketSnapshot, fetchEtfDetails } from '../lib/market-service';

async function main() {
  console.log("🔍 Verifying Market Service...");
  const tickers = ['AAPL', 'SPY', 'XEQT.TO', 'VFV.TO']; // Mix of US Stock, US ETF, CAD ETF

  console.log(`\n--- Testing fetchMarketSnapshot([${tickers.join(', ')}]) ---`);
  try {
    const snapshot = await fetchMarketSnapshot(tickers);
    console.table(snapshot);

    // Validations
    const aapl = snapshot.find(s => s.ticker === 'AAPL');
    const spy = snapshot.find(s => s.ticker === 'SPY');

    if (aapl?.assetType === 'STOCK') console.log("✅ AAPL identified as STOCK");
    else console.error("❌ AAPL Asset Type incorrect:", aapl?.assetType);

    if (spy?.assetType === 'ETF') console.log("✅ SPY identified as ETF");
    else console.error("❌ SPY Asset Type incorrect:", spy?.assetType);

    if (snapshot.length > 0) console.log("✅ Snapshot returned data");
    else console.error("❌ Snapshot returned empty array");

  } catch (err) {
    console.error("❌ fetchMarketSnapshot failed:", err);
  }

  console.log(`\n--- Testing fetchEtfDetails('VFV') (Implicit .TO fallback check) ---`);
  try {
    const details = await fetchEtfDetails('VFV');
    console.log(`Fetched details for: ${details.ticker} (${details.name})`);
    console.log(`Asset Type: ${details.assetType}`);
    console.log(`Price: ${details.price}`);
    console.log(`Sectors:`, details.sectors);
    console.log(`History points: ${details.history.length}`);

    if (details.ticker === 'VFV.TO') console.log("✅ Fallback to .TO worked (or resolved correctly)");
    if (details.assetType === 'ETF') console.log("✅ Asset type is ETF");
    if (Object.keys(details.sectors).length > 0) console.log("✅ Sectors populated");
    else console.warn("⚠️ Sectors empty (might be normal if data missing, but check)");

  } catch (err) {
    console.error("❌ fetchEtfDetails('VFV') failed:", err);
  }
}

main();
