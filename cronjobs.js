const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function runScraper() {
  console.log("⚡ Running Nifty 500 scraper...");

  try {
    const url = 'https://finance.yahoo.com/most-active?count=100&offset=0';
    const { data } = await axios.get('https://finance.yahoo.com/most-active?count=100&offset=0', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  },
  decompress: true // Let Axios handle compression
});


    const $ = cheerio.load(data);

    const stocks = [];

    $('table tbody tr').each((i, el) => {
      const company = $(el).find('td:nth-child(1)').text().trim();
      const price = parseFloat($(el).find('td:nth-child(3)').text().replace(',', ''));
      const change = $(el).find('td:nth-child(4)').text().trim();
      const changePercent = $(el).find('td:nth-child(5)').text().trim();

      if (!company || !price || !change || !changePercent) return;

      stocks.push({
        company,
        price: price.toFixed(2),
        change,
        changePercent
      });
    });

    const gainers = [...stocks]
      .filter(s => s.change.startsWith('+'))
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, 9);

    const losers = [...stocks]
      .filter(s => s.change.startsWith('-'))
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, 9);

    const result = {
      updatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      gainers,
      losers
    };

    const outputPath = path.join(__dirname, 'public', 'nifty500.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log("✅ Nifty 500 data saved to nifty500.json");

  } catch (err) {
    console.error("❌ Error scraping data:", err.message);
  }
}

module.exports = () => {
  console.log("✅ Cron job initialized");

  // ⏰ Schedule daily run at 6 PM IST
  cron.schedule('0 18 * * *', runScraper);

  // 🧪 Trigger once immediately for testing
  runScraper();
};
