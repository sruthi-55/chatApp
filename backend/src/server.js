const http = require('http');
const app = require('./index');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

// convert express app to http server
const server = http.createServer(app);

// adds websocket support
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173", // frontend
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// handle real-time client connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
