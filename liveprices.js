const path = require('path');
const fs = require('fs');

module.exports = (app) => {
  app.get('/api/nifty500', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'nifty500.json');
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'Data not available' });
    }
  });
};
