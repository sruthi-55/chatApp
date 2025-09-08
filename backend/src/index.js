const express = require('express');
const cors = require('cors');
require('dotenv').config(); // loads env variables from .env file into process.env

// 🚨 Render injects DEBUG_URL which breaks Express, remove it
if (process.env.DEBUG_URL) {
  console.log("Deleting DEBUG_URL to avoid path-to-regexp crash");
  delete process.env.DEBUG_URL;
}

const app = express(); // 1. creates app instance

// 2. Register middleware and routes on app
const allowedOrigins = [
  process.env.CLIENT_URL // only 1 URL now
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow requests with no origin

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // explicitly allow OPTIONS
}));

// handle preflight requests for all routes
app.options("*", cors());

// body parser - parses JSON req body and populates req.body
app.use(express.json());

// health check route
app.get('/', (req, res) => {
  res.send('Chat App Backend is running');
});

// 3. import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const friendsRoutes = require("./routes/friends");

// 4. mounts the router
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chats', chatRoutes);
app.use("/api/friends", friendsRoutes);

// 5. export configured express app
module.exports = app;
