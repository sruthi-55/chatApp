// central place to store Socket.IO instance + online users map
let io;  // Socket.IO server instance
const onlineUsers = new Map(); // userId -> socketId

// called from server.js to initialize io
function setSocketInstance(serverIo) {
  io = serverIo;
}

// get io instance safely
function getSocketInstance() {
  if (!io) throw new Error("Socket.IO not initialized yet");
  return io;
}

module.exports = { setSocketInstance, getSocketInstance, onlineUsers };
