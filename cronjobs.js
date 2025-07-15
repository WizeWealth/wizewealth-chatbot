const axios = require('axios');
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

    fs.writeFileSync(
      path.join(outputDir, 'nifty500.json'),
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Data saved to public/nifty500.json");

  } catch (err) {
    console.error("❌ Error in stock cron job:", err.message);
  }
}

// ⚡ Precious metals price fetch Cron Job
async function fetchGoldAndSilverPrice() {
  console.log("🥇 Fetching gold and silver price...");

  try {
    const goldRes = await axios.get('https://www.goldapi.io/api/XAU/INR', {
      headers: {
        'x-access-token': process.env.GOLD_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const silverRes = await axios.get('https://www.goldapi.io/api/XAG/INR', {
      headers: {
        'x-access-token': process.env.GOLD_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const ozToGram = 31.1035;

const goldSpotPerGram = goldRes.data.price / ozToGram;
const goldRetailPerGram = goldSpotPerGram * 1.09;

const silverSpotPerGram = silverRes.data.price / ozToGram;
const silverRetailPerGram = silverSpotPerGram * 1.09;


    const result = {
      gold: {
        price_10g_inr: parseFloat((goldRetailPerGram * 10).toFixed(2)),
        source: '24K Gold',
        updatedAt: new Date().toISOString()
      },
      silver: {
        price_10g_inr: parseFloat((silverRetailPerGram * 10).toFixed(2)),
        updatedAt: new Date().toISOString()
      }
    };

    const outputDir = path.join(__dirname, 'public');
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      path.join(outputDir, 'goldprice.json'),
      JSON.stringify(result, null, 2)
    );

    console.log("✅ Gold & silver prices saved to public/goldprice.json");

  } catch (err) {
    console.error("❌ Failed to fetch gold/silver prices:", err.message);
  }
}

// 🕒 Schedule the stock cron job (6:00 PM IST daily)
module.exports = () => {
    cron.schedule('0 17 * * *', runScraper);              // Nifty 500 → 5:00 PM
    cron.schedule('0 10 * * *', fetchGoldAndSilverPrice); // Gold/Silver → 10:00 AM
  };
  
fetchGoldAndSilverPrice();
runScraper();
