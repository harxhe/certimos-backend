require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.send('NFT Certificate API is running!');
});

// TODO: Add your API routes here

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});