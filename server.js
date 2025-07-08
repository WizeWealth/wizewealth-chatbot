require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🧠 Function to fetch stock price from fuzzy user input
async function getStockPriceByFuzzyName(query) {
  console.log("📈 Triggered stock price function with query:", query);
  const keywords = query.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(' ');
  const likelyName = keywords.find(word =>
    !['price', 'stock', 'share', 'of', 'today', 'tell', 'me', 'what', 'is'].includes(word)
  );

  if (!likelyName) {
    return "Please mention a company name to get its stock price.";
  }

  try {
    // Step 1: Search Yahoo Finance for possible matches
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(likelyName)}&lang=en-US`;
    const searchResponse = await axios.get(searchUrl);
    const matches = searchResponse.data.quotes;

    if (!matches || matches.length === 0) {
      return "Sorry, I couldn't find any stock matching that name.";
    }

    // Step 2: Find an Indian NSE stock (symbol ends in .NS)
    const nseMatch = matches.find(item => item.symbol.endsWith('.NS'));
    const bestMatch = nseMatch || matches[0];

    const stockSymbol = bestMatch.symbol;

    // Step 3: Scrape the live price from Yahoo
    const quoteUrl = `https://finance.yahoo.com/quote/${stockSymbol}`;
    const quoteResponse = await axios.get(quoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(quoteResponse.data);
    const price = $('fin-streamer[data-field="regularMarketPrice"]').first().text().trim();

    if (!price || isNaN(price)) {
      throw new Error("Couldn't find valid stock price on Yahoo.");
    }

    return `The current stock price of ${bestMatch.shortname} (${stockSymbol}) is ₹${price}.`;

  } catch (error) {
    console.error("❌ Yahoo stock scrape failed:", error.message);
    return "Sorry, I couldn't fetch the stock price right now.";
  }
}


app.post('/chat', async (req, res) => {
  console.log("✅ /chat endpoint hit");
  const userMessage = req.body.message;
  console.log("🟡 User message received:", userMessage);
  const timestamp = new Date().toISOString();
  const logFilePath = path.join(__dirname, 'chatlogs.txt');
  
// ✅ Check for stock price query first
if (userMessage.toLowerCase().includes("stock price") || userMessage.toLowerCase().includes("share price")) {
  const stockReply = await getStockPriceByFuzzyName(userMessage);
  return res.json({ reply: stockReply });
}

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are WizeBot, a smart and friendly financial assistant created by WizeWealth.

If a user asks questions like "what is your name?", or "who created you?", always reply exactly like this:

"I am WizeBot, your personal financial assistant created by WizeWealth."

For all other questions, respond helpfully and clearly with financial advice.`
        },
        { role: 'user', content: userMessage }]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;

    // Store the chat log (question + answer) line by line in chatlogs.txt
    const logEntry = { timestamp, question: userMessage, answer: reply };
    const line = JSON.stringify(logEntry) + '\n';

    fs.appendFile(logFilePath, line, (err) => {
      if (err) {
        console.error('❌ Failed to write log:', err);
      } else {
        console.log('✅ Log saved to chatlogs.txt');
      }
    });

    res.json({ reply });

  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    res.status(500).json({ reply: 'Sorry, something went wrong.' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
