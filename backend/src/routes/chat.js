const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  getUserChats,
  createMessage,
  createOrGetDirectChat,
  createDirectChatWithMessage,
} = require("../models/Chat");

const {
  getMessagesByChatId,
  markMessagesAsRead,
} = require("../models/Message");

const { getSocketInstance, onlineUsers } = require("../utils/socket");

const router = express.Router();

// ============================================================
// GET ALL CHATS FOR LOGGED-IN USER
//
// Only chats that already contain messages are returned.
// ============================================================

router.get("/", authMiddleware, async (req, res) => {
  try {
    const chats = await getUserChats(req.userId);

    res.json(chats);
  } catch (err) {
    console.error("Get user chats error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ============================================================
// GET MESSAGES OF A CHAT
// ============================================================

router.get("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;

    const { limit = 20, before } = req.query;

    // Temporary chats don't exist in DB.
    if (String(chatId).startsWith("temp-")) {
      return res.json([]);
    }

    const messages = await getMessagesByChatId(
      chatId,
      req.userId,
      parseInt(limit) || 20,
      before ? parseInt(before) : undefined,
    );

    res.json(messages);
  } catch (err) {
    console.error("Get chat messages error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ============================================================
// SEND MESSAGE
//
// Existing chat:
//   chatId = real DB chat ID
//
// Temporary chat:
//   chatId = temp-...
//
// Temporary chat flow:
//
//   temp chat
//       ↓
//   create/get real direct chat
//       ↓
//   create message
//       ↓
//   return real chat ID + message
// ============================================================

router.post("/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;

    const { content, friendId } = req.body;

    // ========================================================
    // Validate message
    // ========================================================

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content required",
      });
    }

    // ========================================================
    // TEMPORARY CHAT
    // ========================================================

    if (String(chatId).startsWith("temp-")) {
      if (!friendId) {
        return res.status(400).json({
          message: "friendId required for temporary chat",
        });
      }

      const result = await createDirectChatWithMessage(
        req.userId,
        Number(friendId),
        content.trim(),
      );

      return res.status(201).json({
        chatId: result.chat.id,
        chat: result.chat,
        message: result.message,
      });
    }

    // ========================================================
    // EXISTING CHAT
    // ========================================================

    const message = await createMessage(
      Number(chatId),
      req.userId,
      content.trim(),
    );

    return res.status(200).json({
      chatId: Number(chatId),
      message,
    });
  } catch (err) {
    console.error("Send message error:", err);

    res.status(err.status || 500).json({
      message: err.message || "Server error",
    });
  }
});

// ============================================================
// SEND FIRST MESSAGE TO A USER
//
// This endpoint is kept for compatibility.
//
// The current ChatWindow uses:
//   POST /chats/:temporaryId/messages
//
// so this endpoint isn't required by that flow.
// ============================================================

router.post("/message", authMiddleware, async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        message: "receiverId required",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Message content required",
      });
    }

    const result = await createDirectChatWithMessage(
      req.userId,
      Number(receiverId),
      content.trim(),
    );

    res.status(201).json(result);
  } catch (err) {
    console.error("Create chat and send first message error:", err);

    res.status(err.status || 500).json({
      message: err.message || "Server error",
    });
  }
});

// ============================================================
// START DIRECT CHAT
//
// This endpoint can still be used elsewhere.
//
// It DOES create an empty chat, so it should NOT be used
// merely for opening a temporary chat.
// ============================================================

router.post("/start", authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({
        error: "friendId required",
      });
    }

    const chat = await createOrGetDirectChat(req.userId, Number(friendId));

    res.json(chat);
  } catch (err) {
    console.error("Start chat error:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// ============================================================
// MARK CHAT MESSAGES AS READ
//
// Called by the receiver when messages currently loaded in
// ChatWindow become visible/read.
//
// Body:
//
// {
//   "messageIds": [31, 32, 33]
// }
//
// Only messages sent by OTHER users are marked as read.
//
// After the DB update, the sender receives:
//
// "messagesRead"
// ============================================================

router.post("/:chatId/read", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messageIds } = req.body;

    console.log("READ REQUEST RECEIVED:", {
      chatId,
      userId: req.userId,
      messageIds,
    });

    // ========================================================
    // TEMPORARY CHAT
    // ========================================================

    if (String(chatId).startsWith("temp-")) {
      return res.json({
        messageIds: [],
      });
    }

    // ========================================================
    // VALIDATE MESSAGE IDS
    // ========================================================

    if (!Array.isArray(messageIds)) {
      return res.status(400).json({
        message: "messageIds must be an array",
      });
    }

    if (messageIds.length === 0) {
      return res.json({
        messageIds: [],
      });
    }

    // ========================================================
    // MARK MESSAGES AS READ IN DATABASE
    // ========================================================

    console.log("Marking messages as read:", {
      chatId,
      userId: req.userId,
      messageIds,
    });

    const readMessages = await markMessagesAsRead(
      Number(chatId),
      Number(req.userId),
      messageIds,
    );

    console.log("Messages successfully marked as read:", readMessages);

    // ========================================================
    // GET SOCKET.IO INSTANCE
    // ========================================================

    const socketIO = getSocketInstance();

    // ========================================================
    // GROUP MESSAGES BY SENDER
    //
    // Example:
    //
    // sender 9 -> [56, 58]
    // sender 15 -> [61]
    //
    // ========================================================

    const messagesBySender = new Map();

    readMessages.forEach((message) => {
      const senderId = Number(message.senderId);

      if (!senderId) {
        return;
      }

      if (!messagesBySender.has(senderId)) {
        messagesBySender.set(senderId, []);
      }

      messagesBySender.get(senderId).push(message.messageId);
    });

    // ========================================================
    // NOTIFY EACH SENDER
    // ========================================================

    for (const [senderId, messageIdsForSender] of messagesBySender) {
      const senderSocketId = onlineUsers.get(senderId);

      console.log("Read notification:", {
        senderId,
        senderSocketId,
        messageIds: messageIdsForSender,
      });

      if (!senderSocketId) {
        continue;
      }

      socketIO.to(senderSocketId).emit("messagesRead", {
        chatId: Number(chatId),
        messageIds: messageIdsForSender,
        readBy: Number(req.userId),
      });
    }

    // ========================================================
    // RETURN TO RECEIVER
    // ========================================================

    return res.json({
      messageIds: readMessages.map((message) => message.messageId),
    });
  } catch (err) {
    console.error("Mark messages as read error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
