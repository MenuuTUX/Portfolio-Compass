
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

async function main() {
  const ticker = 'SPY';
  console.log(`Fetching details for ${ticker}...`);

  try {
    const data = await yf.quoteSummary(ticker, {
      modules: ['topHoldings']
    });

    console.log("Top Holdings Data:");
    console.log(JSON.stringify(data.topHoldings, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
