const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  createFriendRequest,
  getFriendRequestsForUser,
  updateFriendRequestStatus,
  getAllFriends,
} = require("../models/Friend");
const { getUserById } = require("../models/User");
const { getSocketInstance, onlineUsers } = require("../utils/socket");

const pool = require("../utils/db");
const router = express.Router();

//# get all friends of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.userId;

  try {
    const friends = await getAllFriends(userId);
    res.json(friends);
  } catch (err) {
    console.error("Error fetching friends:", err);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

//# send friend request
router.post("/request", authMiddleware, async (req, res) => {
  try {
    const { receiver_id } = req.body;
    if (!receiver_id)
      return res.status(400).json({ message: "receiver_id required" });

    const fr = await createFriendRequest(req.userId, Number(receiver_id));

    const sender = await getUserById(req.userId);
    const receiver = await getUserById(Number(receiver_id));

    const io = getSocketInstance();
    const receiverSocketId = onlineUsers.get(Number(receiver_id));

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("friendRequestSent", {
        id: fr.id,
        sender: {
          id: sender.id,
          username: sender.username,
          avatar: sender.avatar,
        },
        receiver: {
          id: receiver.id,
          username: receiver.username,
          avatar: receiver.avatar,
        },
        status: "pending",
        createdAt: fr.created_at,
      });
    }

    res.status(201).json({ message: "Friend request sent", request: fr });
  } catch (err) {
    console.error("Send friend request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

//# get all friend requests (incoming + outgoing) 
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const data = await getFriendRequestsForUser(req.userId);
    res.json(data);
  } catch (err) {
    console.error("List friend requests error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//# get only PENDING friend requests
router.get("/requests/pending", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const { incoming, outgoing } = await getFriendRequestsForUser(userId);

    const incomingPending = incoming.filter(r => r.status === "pending");
    const outgoingPending = outgoing.filter(r => r.status === "pending");

    res.json({ incoming: incomingPending, outgoing: outgoingPending });
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//# accept a friend request
router.post("/requests/:id/accept", authMiddleware, async (req, res) => {
  try {
    const updated = await updateFriendRequestStatus(req.params.id, req.userId, "accepted");

    const io = getSocketInstance();
    const senderSocketId = onlineUsers.get(updated.sender_id);
    const receiverSocketId = onlineUsers.get(updated.receiver_id);

    [senderSocketId, receiverSocketId].forEach((sid) => {
      if (sid) io.to(sid).emit("friendRequestAccepted", updated);
    });

    res.json({ message: "Request accepted", request: updated });
  } catch (err) {
    console.error("Accept request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

//# reject a friend request
router.post("/requests/:id/reject", authMiddleware, async (req, res) => {
  try {
    const updated = await updateFriendRequestStatus(req.params.id, req.userId, "rejected");

    const io = getSocketInstance();
    const senderSocketId = onlineUsers.get(updated.sender_id);
    const receiverSocketId = onlineUsers.get(updated.receiver_id);

    [senderSocketId, receiverSocketId].forEach((sid) => {
      if (sid) io.to(sid).emit("friendRequestRejected", updated);
    });

    res.json({ message: "Request rejected", request: updated });
  } catch (err) {
    console.error("Reject request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

//# get friendship/request status with another user
router.get("/status/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const otherId = Number(req.params.id);

  try {
    const friends = await getAllFriends(userId);
    if (friends.some(f => f.id === otherId)) {
      return res.json({ status: "friends", requestId: null });
    }

    const client = await pool.connect();
    try {
      const frRes = await client.query(
        `SELECT id, sender_id, receiver_id, status
         FROM friend_requests
         WHERE (sender_id=$1 AND receiver_id=$2)
            OR (sender_id=$2 AND receiver_id=$1)
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, otherId]
      );

      if (frRes.rows.length === 0) {
        return res.json({ status: "none", requestId: null });
      }

      const fr = frRes.rows[0];

      if (fr.status === "pending") {
        if (fr.sender_id === userId) {
          return res.json({ status: "sent", requestId: fr.id });
        } else {
          return res.json({ status: "pending", requestId: fr.id });
        }
      }

      if (fr.status === "accepted") {
        return res.json({ status: "friends", requestId: fr.id });
      }

      if (fr.status === "rejected") {
        return res.json({ status: "none", requestId: null });
      }

      return res.json({ status: "none", requestId: null });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
