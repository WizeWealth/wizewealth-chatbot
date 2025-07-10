require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🧠 Function to fetch stock price from fuzzy user input
async function getStockPriceByFuzzyName(query) {
  console.log("📈 Triggered stock price function with query:", query);
  const keywords = query.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(word =>
    !['price', 'stock', 'share', 'of', 'today', 'tell', 'me', 'what', 'is'].includes(word)
  );

  if (keywords.length === 0) {
    return "Please mention a company name to get its stock price.";
  }

  try {
    // Step 1: Search Yahoo Finance for possible matches
    const searchQuery = keywords.join(' ');
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&lang=en-US&region=IN`;
    const searchResponse = await axios.get(searchUrl);
    const matches = searchResponse.data.quotes;

    if (!matches || matches.length === 0) {
      return "Sorry, I couldn't find any stock matching that name.";
    }

    // Step 2: Try exact match (shortname matches exactly)
const exactMatch = matches.find(m =>
  m.exchange === 'NSE' &&
  m.shortname.toLowerCase() === searchQuery.toLowerCase()
);

// Step 3: All keywords match in shortname
const refinedMatch = matches.find(m =>
  m.exchange === 'NSE' &&
  keywords.every(word =>
    m.shortname.toLowerCase().includes(word) ||
    m.symbol.toLowerCase().includes(word)
  )
);

// Step 4: Loose partial match (contains any keyword)
const partialMatch = matches.find(m =>
  m.exchange === 'NSE' &&
  keywords.some(word =>
    m.shortname.toLowerCase().includes(word) ||
    m.symbol.toLowerCase().includes(word)
  )
);

// Step 5: NSE fallback
const nseMatch = matches.find(m => m.exchange === 'NSE');

// Step 6: Final fallback
const bestMatch = exactMatch || refinedMatch || partialMatch || nseMatch || matches[0];


    const stockSymbol = bestMatch.symbol;

    console.log("🎯 Matched:", bestMatch.shortname, stockSymbol);

    // Step 6: Use Yahoo's JSON API to fetch price
    const quoteApiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stockSymbol}`;
    const quoteResponse = await axios.get(quoteApiUrl);
    const price = quoteResponse.data.chart.result[0].meta.regularMarketPrice;

    if (!price || isNaN(price)) {
      return `Sorry, I found ${stockSymbol} but couldn’t get its price.`;
    }

    return `The current stock price of ${bestMatch.shortname} (${stockSymbol}) is ₹${price.toFixed(2)}.`;

  } catch (error) {
    console.error("❌ Yahoo stock fetch failed:", error.message);
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
const msg = userMessage.toLowerCase();

const isStockQuery =
  /(stock|share)/i.test(msg) &&
  /(price|value|quote|rate)/i.test(msg);

if (isStockQuery) {
  console.log("🧠 Detected stock query intent");
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
