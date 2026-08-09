const http = require("http");

// Remove DEBUG_URL if present to prevent Render crash
if (process.env.DEBUG_URL) {
  delete process.env.DEBUG_URL;
}

const app = require("./index");

const { Server } = require("socket.io");

const { setSocketInstance, onlineUsers } = require("./utils/socket");

const { getChatMemberIds } = require("./models/Chat");

const PORT = process.env.PORT || 5001;

// ============================================================
// CREATE HTTP SERVER
// ============================================================

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

// ============================================================
// REGISTER SOCKET INSTANCE
// ============================================================

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

    if (!parsedUserId) {
      return;
    }

    onlineUsers.set(parsedUserId, socket.id);

    console.log(`User ${parsedUserId} registered with socket ${socket.id}`);
  });

  // ==========================================================
  // JOIN CHAT ROOM
  //
  // Still useful for chat-specific socket communication.
  // ==========================================================

  socket.on("joinRoom", (chatId) => {
    socket.join(String(chatId));

    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // ==========================================================
  // LEAVE CHAT ROOM
  // ==========================================================

  socket.on("leaveRoom", (chatId) => {
    socket.leave(String(chatId));

    console.log(`Socket ${socket.id} left chat ${chatId}`);
  });

  // ==========================================================
  // SEND MESSAGE
  //
  // IMPORTANT:
  //
  // Do NOT only emit to the chat room.
  //
  // A user may not currently have this chat open.
  //
  // Example:
  //
  // User B is viewing Chat 5.
  //
  // User A sends a message in Chat 11.
  //
  // User B is NOT inside room 11.
  //
  // Therefore:
  //
  //     io.to(11).emit(...)
  //
  // would never reach User B.
  //
  // Instead, find all chat members and notify their
  // currently connected sockets directly.
  // ==========================================================

  socket.on("sendMessage", async (message) => {
    try {
      console.log("Server got sendMessage:", message);

      const chatId = Number(message.chat_id ?? message.chatId);

      const senderId = Number(message.sender_id);

      if (!chatId || !senderId) {
        console.error("Invalid sendMessage payload:", message);

        return;
      }

      // ======================================================
      // Get all users belonging to this chat
      // ======================================================

      const memberIds = await getChatMemberIds(chatId);

      // ======================================================
      // Notify every ONLINE member
      //
      // This includes sender.
      //
      // Sender's ChatWindow ignores its own message because
      // sender_id === current user.
      // ======================================================

      for (const memberId of memberIds) {
        const socketId = onlineUsers.get(Number(memberId));

        if (!socketId) {
          continue;
        }

        io.to(socketId).emit("newMessage", {
          ...message,
          chat_id: chatId,
        });
      }
    } catch (err) {
      console.error("Socket sendMessage error:", err);
    }
  });

  // ==========================================================
  // DISCONNECT
  // ==========================================================

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);

        console.log(`Removed online user ${userId}`);

        break;
      }
    }
  });
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = {
  server,
};
