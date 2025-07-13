const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

require('dotenv').config();

// Load your modules
require('./wizebot')(app);         // ← WizeBot logic
require('./liveprices')(app);      // ← Stock/MF price logic

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WizeWealth backend running on port ${PORT}`);
});
