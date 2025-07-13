const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve static files from public folder
app.use(express.static('public'));

require('dotenv').config();

// Load your modules
require('./wizebot')(app);         // ← WizeBot logic
require('./liveprices')(app);      // ← Stock/MF price logic

// ✅ Load and start scheduled cron jobs
require('./cronjobs')();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WizeWealth backend running on port ${PORT}`);
});
