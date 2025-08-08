const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// health check route
app.get('/', (req, res) => {
  res.send('Chat App Backend is running');
});

module.exports = app;