const http = require('http');       // node's built-in http module
const app = require('./index');     // express app
const { Server } = require('socket.io');    

const PORT = process.env.PORT || 5001;

// convert express app to http server
const server = http.createServer(app);
// wraps your Express app so it can handle both - normal HTTP requests and WebSocket connections


// create Socket.IO server
// attaches Socket.IO to http server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // your frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// handle real-time client connections
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("joinRoom", (chatId) => {
    socket.join(chatId); // join chat room
  });

  socket.on("sendMessage", (message) => {
    // broadcast only to room members
    socket.to(message.chat_id).emit("newMessage", message);
  });

  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
