// 🚨 Fix Render DEBUG_URL crash
if (process.env.DEBUG_URL) {
  console.log("Removing DEBUG_URL injected by Render...");
  delete process.env.DEBUG_URL;
}

const http = require('http');
const app = require('./index');
const { Server } = require('socket.io');
const { setSocketInstance, onlineUsers } = require('./utils/socket');

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

setSocketInstance(io);

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

module.exports = { server };
