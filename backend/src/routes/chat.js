const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getUserChats, createMessage } = require("../models/Chat");
const {getMessagesByChatId} = require("../models/Message")

const router = express.Router();

// get all chats for logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await getUserChats(req.userId);
    res.json(chats);
  } catch (err) {
    console.error("Get user chats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// get messages of a chat
router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await getMessagesByChatId(chatId);
    res.json(messages);
  } catch (err) {
    console.error("Get chat messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// send a message
router.post("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "Message content required" });

    const message = await createMessage(chatId, req.userId, content);
    res.status(200).json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
