const cron = require('node-cron');
const yahooFinance = require('yahoo-finance2').default;
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

console.log("✅ Cronjob service initialized");

// 🔁 Load symbols from CSV
async function getSymbolsFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const symbols = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const symbol = row[Object.keys(row)[2]]; // column C (3rd column)
        if (symbol) symbols.push(symbol.trim() + '.NS');
      })
      .on('end', () => resolve(symbols))
      .on('error', reject);
  });
}

// ⚡ Nifty 500 Top Gainers/Losers Cron Job
async function runScraper() {
  console.log("⚡ Running Nifty 500 API fetch...");

  const csvPath = path.join(__dirname, 'nifty500.csv');
  const niftySymbols = await getSymbolsFromCSV(csvPath);

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

    const parsePercent = (p) => parseFloat(p.replace('%', ''));

// Top gainers: highest positive % change
const gainers = [...stockData]
  .filter(s => parseFloat(s.change) > 0)
  .sort((a, b) => parsePercent(b.changePercent) - parsePercent(a.changePercent))
  .slice(0, 9);

// Top losers: highest negative % change
const losers = [...stockData]
  .filter(s => parseFloat(s.change) < 0)
  .sort((a, b) => parsePercent(a.changePercent) - parsePercent(b.changePercent))
  .slice(0, 9);


    const result = {
      updatedAt: new Date().toISOString(),
      gainers,
      losers
    };

    const outputDir = path.join(__dirname, 'public');
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      path.join(outputDir, 'nifty500.json'),
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Data saved to public/nifty500.json");

  } catch (err) {
    console.error("❌ Error in stock cron job:", err.message);
  }
}

// 🕒 Schedule the stock cron job (6:00 PM IST daily)
module.exports = () => {
  cron.schedule('15 18 * * *', runScraper, {
  timezone: 'Asia/Kolkata'
});
};
