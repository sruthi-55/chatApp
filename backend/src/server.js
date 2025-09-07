const http = require('http');
const app = require('./index');
const { Server } = require('socket.io');
const { setSocketInstance, onlineUsers } = require('./utils/socket');  // import socket utility

const PORT = process.env.PORT || 5001;

// create HTTP server
const server = http.createServer(app);

// create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// register io instance in socket utils
setSocketInstance(io);  // now other files can safely access io

// handle connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // when a client tells us who they are
  socket.on("registerUser", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("joinRoom", (chatId) => {
    socket.join(chatId);
  });

  socket.on("sendMessage", (message) => {
    // broadcast to everyone in room including sender
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

// export server only, io handled via utils/socket
module.exports = { server };
