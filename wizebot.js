require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


function registerWizeBotRoutes(app) {
  // 🧠 Function to fetch stock price from fuzzy user input
async function getStockPriceByFuzzyName(query) {
  console.log("📈 Triggered stock price function with query:", query);
  const cleanedQuery = query.toLowerCase().replace(/['']/g, '').replace(/[^a-z\s]/g, '');
const words = cleanedQuery.split(/\s+/);
const stopWords = ['price', 'stock', 'share', 'of', 'today', 'tell', 'me', 'what', 'is', 'can', 'you', 'please', 'the', 'value', 'quote', 'rate'];

let keywords = words.filter(word => !stopWords.includes(word));
let searchQuery = keywords.join(' ');

// 🧠 Fallback: If no meaningful keywords found, try using the last 3 words
if (!searchQuery || searchQuery.length < 3) {
  searchQuery = words.slice(-3).join(' ');
}


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
const bestMatch =
  (exactMatch && exactMatch.symbol.endsWith('.NS')) ||
  (refinedMatch && refinedMatch.symbol.endsWith('.NS')) ||
  (partialMatch && partialMatch.symbol.endsWith('.NS')) ||
  matches.find(m => m.symbol.endsWith('.NS')) ||
  matches[0];



    const stockSymbol = bestMatch.symbol;

    console.log("🎯 Matched:", bestMatch.shortname, stockSymbol);

    // Step 6: Use Yahoo's JSON API to fetch price
    const quoteApiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stockSymbol}`;
    const quoteResponse = await axios.get(quoteApiUrl);
    const price = quoteResponse.data.chart.result[0].meta.regularMarketPrice;

    if (!price || isNaN(price)) {
      return `Sorry, I found ${stockSymbol} but couldn't get its price.`;
    }

    return `The current stock price of ${bestMatch.shortname} (${stockSymbol}) is ₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;


  } catch (error) {
    console.error("❌ Yahoo stock fetch failed:", error.message);
    return "Sorry, I couldn't fetch the stock price right now.";
  }
}

// 🧠 Function to fetch Precious metal like gold and silver price
function getPreciousMetalPrice(query) {
  console.log("🔍 Checking cached gold/silver price");

  const cleanedQuery = query.toLowerCase();
  const isGold = /gold/i.test(cleanedQuery);
  const isSilver = /silver/i.test(cleanedQuery);

  if (!isGold && !isSilver) {
    return "Please mention if you want the price of gold or silver.";
  }

  try {
    const filePath = path.join(__dirname, 'public/goldprice.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const prices = JSON.parse(data);

    const gold = prices.gold?.price_10g_inr;
    const silver = prices.silver?.price_10g_inr;

    let reply = "🪙 Current metal prices:\n";
    if (isGold && gold) {
      reply += `• 24K Gold (10g): ₹${gold.toLocaleString('en-IN')}\n`;
    }
    if (isSilver && silver) {
      reply += `• Silver (10g): ₹${silver.toLocaleString('en-IN')}`;
    }

    return reply.trim() || "Sorry, I couldn't find the current price.";
  } catch (err) {
    console.error("❌ Failed to read goldprice.json:", err.message);
    return "Sorry, price data isn't available at the moment.";
  }
}



  app.post('/api/wisebot', async (req, res) => {
    console.log("✅ /chat endpoint hit");
    const userMessage = req.body.message;
    console.log("🟡 User message received:", userMessage);
    
    // 🔹 Custom quick replies for default suggestions - CHECK THIS FIRST
    const quickReplies = {
      "when should i buy a car?": "You should buy a car when it’s both a practical need and a financially sound decision. Ideally, this is when you have a stable income, an emergency fund in place, and can comfortably afford the down payment and EMIs without compromising your other financial goals. Your monthly car loan EMI should not exceed 15–20% of your income, and you should aim to make at least a 20–30% down payment to avoid excessive debt. Also consider ongoing costs like fuel, insurance, maintenance, and parking. Buying a car makes sense when it adds real value to your life—not just status or emotion—and fits within your financial limits.",
      "where to invest 1 lakh rupees?": "If you have ₹1 lakh to invest, the best option depends on your financial goals and risk appetite. For low-risk, short-term goals (1–3 years), consider fixed deposits, liquid mutual funds, or short-term debt funds for stable returns. If you’re aiming for moderate growth over 3–5 years, hybrid mutual funds or SIPs in index funds offer a balanced mix of safety and returns. For long-term wealth creation (5+ years) and higher risk tolerance, invest in equity index funds like Nifty 50 or Sensex, or consider diversified mutual funds. To reduce risk, you can also allocate a small portion (5–10%) to gold via ETFs or Sovereign Gold Bonds.",
      "is it a good time to buy gold?": "Gold prices are currently near all-time highs due to global economic uncertainty, inflation, and geopolitical tensions, making it a good hedge against market volatility. While returns may be more modest going forward, investing a small portion (5–10%) of your portfolio in gold can help diversify and protect your wealth. If you’re considering investing now, it’s wiser to enter gradually through options like Sovereign Gold Bonds or Gold ETFs rather than buying jewellery. Overall, it’s a reasonable time to buy gold for long-term safety, but not ideal if you’re expecting quick profits.",
      "how to create an emergency fund?": "Start by setting a target—aim for 3 to 6 months’ worth of your essential expenses (like rent, food, bills, EMIs). For example, if your monthly expenses are ₹20,000, your emergency fund should be ₹60,000 to ₹1.2 lakh. Begin saving a fixed amount every month—say ₹2,000–₹5,000—into a separate savings account or a liquid mutual fund (for slightly better returns but easy access). Avoid using this fund unless it’s a real emergency like a job loss, medical need, or urgent repairs. Keep it easily accessible but not mixed with your regular spending account to avoid temptations.",
      "how to start investing in stocks?": "To start investing in stocks, first ensure you have an emergency fund and clear financial goals. Open a Demat and trading account through platforms like Zerodha, Groww, or Upstox. Begin with small amounts and invest in well-known companies or index funds to reduce risk. Learn basic stock market concepts like P/E ratio, market cap, and the difference between stocks and mutual funds. Avoid chasing tips or panic-selling during market dips. Stay consistent, invest regularly (via SIPs if possible), and focus on long-term growth to build wealth through the power of compounding."
    };
    
    // 🔹 Normalize the user message for comparison
    const normalized = userMessage.trim().toLowerCase();
    console.log("🔍 Normalized message:", normalized);
    console.log("🔍 Available quick replies:", Object.keys(quickReplies));
    
    // 🔹 Check for exact match first - HIGHEST PRIORITY
    if (quickReplies[normalized]) {
      console.log("✅ Found exact match for quick reply");
      return res.json({ reply: quickReplies[normalized] });
    }
    
    const timestamp = new Date().toISOString();
    const logFilePath = path.join(__dirname, 'chatlogs.txt');
    
    // ✅ Check for stock price query
    const msg = userMessage.toLowerCase();

    const isStockQuery =
      /(stock|share)/i.test(msg) &&
      /(price|value|quote|rate)/i.test(msg);

    if (isStockQuery) {
      console.log("🧠 Detected stock query intent");
      const stockReply = await getStockPriceByFuzzyName(userMessage);
      return res.json({ reply: stockReply });
    }
    
    // ✅ Check for precious metal price query
    const isMetalQuery =
      /(gold|silver)/i.test(msg) &&
      /(price|rate|cost|value)/i.test(msg);

    if (isMetalQuery) {
      console.log("🧠 Detected precious metal query intent");
      const metalReply = getPreciousMetalPrice(userMessage);
      return res.json({ reply: metalReply });
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are WizeBot, a smart and friendly financial assistant created by WizeWealth.`
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
  
  console.log('✅ wizebot.js loaded');
}

module.exports = registerWizeBotRoutes;