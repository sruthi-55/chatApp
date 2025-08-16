const express = require('express');
const cors = require('cors');
require('dotenv').config();     // loads env variables from .env file into process.env


const app = express();      //1. creates app instance

//2. Register middleware and routes on app

// helps set the right CORS headers so browsers allow cross-origin requests from your frontend
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,    // when credentials: true you cannot use origin: '*'
}));


app.use(express.json());    
// body parser - parses JSON req body and populates req.body


// health check route
app.get('/', (req, res) => {
  res.send('Chat App Backend is running');      // 200 response with text
}); 


//3. import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const friendsRoutes = require("./routes/friends");

//4. mounts the router
// requests for '/api/auth' are forwarded to the authRoutes router
app.use('/api/auth', authRoutes);     // all routes here will be prefixed with /api/auth
app.use('/api/user', userRoutes);
app.use('/api/chats', chatRoutes);
app.use("/api/friends", friendsRoutes);


//5. export configured express app
module.exports = app;