const http = require("http");

if (process.env.DEBUG_URL) {
  delete process.env.DEBUG_URL;
}

const app = require("./index");

const { Server } = require("socket.io");

const { setSocketInstance, onlineUsers } = require("./utils/socket");

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================

const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

// Make Socket.IO available to routes.
setSocketInstance(io);

// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // ==========================================================
  // REGISTER USER
  // ==========================================================

  socket.on("registerUser", (userId) => {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId)) {
      return;
    }

    onlineUsers.set(parsedUserId, socket.id);

    console.log(`User ${parsedUserId} registered with socket ${socket.id}`);
  });

  // ==========================================================
  // JOIN CHAT ROOM
  // ==========================================================

  socket.on("joinRoom", (chatId) => {
    if (!chatId) {
      return;
    }

    socket.join(String(chatId));

    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // ==========================================================
  // LEAVE CHAT ROOM
  // ==========================================================

  socket.on("leaveRoom", (chatId) => {
    if (!chatId) {
      return;
    }

    socket.leave(String(chatId));

    console.log(`Socket ${socket.id} left chat ${chatId}`);
  });

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  socket.on("sendMessage", (message) => {
    console.log("Server got sendMessage:", message);

    if (!message?.chat_id) {
      return;
    }

    io.to(String(message.chat_id)).emit("newMessage", message);
  });

  // ==========================================================
  // DISCONNECT
  // ==========================================================

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);

        break;
      }
    }
  });
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = {
  server,
};
