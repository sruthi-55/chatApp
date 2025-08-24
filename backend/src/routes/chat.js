const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getUserChats, createMessage, createOrGetDirectChat } = require("../models/Chat");
const { getMessagesByChatId } = require("../models/Message");

const router = express.Router();

//# get all chats for logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await getUserChats(req.userId);
    res.json(chats);
  } catch (err) {
    console.error("Get user chats error:", err);
    res.status(500).json({ message: "Server error" });    // Internal Server Error
  }
});


//# get messages of a chat with optional pagination
router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 20, before } = req.query;
    // limit - no. of mssgs, before - fetch older messages

    const messages = await getMessagesByChatId(
      chatId,
      parseInt(limit) || 20,
      before ? parseInt(before) : undefined
    );
    res.json(messages);
  } catch (err) {
    console.error("Get chat messages error:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  }
});


//# send a message
router.post("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    if (!content)
      return res.status(400).json({ message: "Message content required" });     // Bad request

    const message = await createMessage(chatId, req.userId, content);
    res.status(200).json(message);    
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  }
});


//# start a direct chat with a friend
router.post("/start", authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: "friendId required" });

    // Use req.userId instead of req.user.id
    const chat = await createOrGetDirectChat(req.userId, friendId);
    res.json(chat);
  } catch (err) {
    console.error("Start chat error:", err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;
