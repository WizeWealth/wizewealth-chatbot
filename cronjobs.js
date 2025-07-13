const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

module.exports = () => {
  console.log("✅ Cron job initialized");

  cron.schedule('0 18 * * *', async () => {
    console.log("🕕 Running scheduled task at 6 PM...");

    try {
      const url = 'https://finance.yahoo.com/most-active?count=100&offset=0';
      const { data } = await axios.get(url);
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
      console.log("✅ Nifty 500 data updated");

    } catch (err) {
      console.error("❌ Error in cron job:", err.message);
    }
  });
};
