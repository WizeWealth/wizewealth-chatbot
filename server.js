
// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = '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'; // Replace with your OpenAI key

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  const timestamp = new Date().toISOString();
  const logFilePath = path.join(__dirname, 'chatlogs.txt');

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: userMessage }]
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

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
