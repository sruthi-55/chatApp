// ============================================================
// CENTRAL SOCKET.IO STATE
// ============================================================

// Socket.IO server instance.
let io = null;

// userId -> socketId
//
// Example:
//
// 5 -> "abc123"
// 7 -> "xyz789"
//
const onlineUsers = new Map();

// ============================================================
// SET SOCKET.IO INSTANCE
// ============================================================

function setSocketInstance(serverIo) {
  io = serverIo;
}

// ============================================================
// GET SOCKET.IO INSTANCE
// ============================================================

function getSocketInstance() {
  if (!io) {
    throw new Error("Socket.IO not initialized yet");
  }

  return io;
}

// ============================================================
// REGISTER ONLINE USER
//
// Always convert userId to Number.
//
// This prevents:
//
// "5" !== 5
//
// problems inside Map.
// ============================================================

function registerOnlineUser(userId, socketId) {
  onlineUsers.set(Number(userId), socketId);
}

// ============================================================
// REMOVE ONLINE USER
// ============================================================

function removeOnlineUser(socketId) {
  for (const [userId, storedSocketId] of onlineUsers.entries()) {
    if (storedSocketId === socketId) {
      onlineUsers.delete(userId);
      break;
    }
  }
}

module.exports = {
  setSocketInstance,
  getSocketInstance,
  onlineUsers,
  registerOnlineUser,
  removeOnlineUser,
};
