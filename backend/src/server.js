const http = require('http');

// 🚨 Render injects DEBUG_URL which breaks Express, remove it
if (process.env.DEBUG_URL) {
  console.log("Deleting DEBUG_URL to avoid path-to-regexp crash");
  delete process.env.DEBUG_URL;
}

const app = require('./index');
const { Server } = require('socket.io');
const { setSocketInstance, onlineUsers } = require('./utils/socket'); // import socket utility

const PORT = process.env.PORT || 5001;

// create HTTP server
const server = http.createServer(app);

// allowed origins for Socket.IO
const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

// create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"], // include OPTIONS for preflight
    credentials: true,
  },
});

// register io instance in socket utils
setSocketInstance(io);

// handle connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("registerUser", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("joinRoom", (chatId) => {
    socket.join(chatId);
  });

  socket.on("sendMessage", (message) => {
    console.log("Server got sendMessage:", message);
    io.to(message.chat_id).emit("newMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    for (let [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// export server only
module.exports = { server };
    
