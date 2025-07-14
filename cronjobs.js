const cron = require('node-cron');
const yahooFinance = require('yahoo-finance2').default;
const fs = require('fs');
const path = require('path');

// Define your Nifty 500 symbols — add more as needed
const niftySymbols = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
  'LT.NS', 'ITC.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'ASIANPAINT.NS',
  'MARUTI.NS', 'BAJFINANCE.NS', 'AXISBANK.NS', 'HINDUNILVR.NS', 'WIPRO.NS',
  'SUNPHARMA.NS', 'HCLTECH.NS', 'TITAN.NS', 'ULTRACEMCO.NS', 'POWERGRID.NS',
  // Add the rest of the Nifty 500 here or load from a file later
];

async function runScraper() {
  console.log("⚡ Running Nifty 500 API fetch...");

  try {
    const stockData = [];

    for (const symbol of niftySymbols) {
      try {
        const quote = await yahooFinance.quote(symbol);
        if (!quote || !quote.regularMarketPrice) continue;

        stockData.push({
          company: quote.shortName || quote.symbol,
          price: quote.regularMarketPrice.toFixed(2),
          change: quote.regularMarketChange?.toFixed(2) || '0.00',
          changePercent: `${quote.regularMarketChangePercent?.toFixed(2) || '0.00'}%`
        });
      } catch (err) {
        console.warn(`⚠️ Skipping ${symbol}: ${err.message}`);
      }
    }

    const gainers = [...stockData]
      .filter(s => parseFloat(s.change) > 0)
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, 9);

    const losers = [...stockData]
      .filter(s => parseFloat(s.change) < 0)
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, 9);

    const result = {
      updatedAt: new Date().toISOString(),
      gainers,
      losers
    };

    const outputDir = path.join(__dirname, 'public');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'nifty500.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log("✅ Data saved to public/nifty500.json");

  } catch (err) {
    console.error("❌ Error in cron job:", err.message);
  }
}

module.exports = () => {
  console.log("✅ Cron job initialized");

  // Schedule the job to run at 6 PM IST every day
  cron.schedule('0 18 * * *', runScraper);

  // Run once immediately (for testing)
  runScraper();
};

