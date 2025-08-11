const http = require('http');       // node's built-in http module
const app = require('./index');     // express app
const { Server } = require('socket.io');    

const PORT = process.env.PORT || 5000;

// convert express app to http server
const server = http.createServer(app);
// wraps your Express app so it can handle both - normal HTTP requests and WebSocket connections


// create Socket.IO server
// attaches Socket.IO to http server
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173", // frontend
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// handle real-time client connections
io.on('connection', (socket) => {
  // runs every time a new client connects to your Socket.IO server
  // socket - individual connection obj for that client
  console.log('New client connected:', socket.id);

  // runs when a client disconnects
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
