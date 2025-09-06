const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  createFriendRequest,
  getFriendRequestsForUser,
  updateFriendRequestStatus,
  getAllFriends,
} = require("../models/Friend");

const pool = require("../utils/db");
const router = express.Router();

//# get all friends of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.userId; // or req.user.id depending on your middleware

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
    // frontend should send { receiver_id }
    const { receiver_id } = req.body;
    if (!receiver_id) 
      return res.status(400).json({ message: "receiver_id required" });     // Bad request

    const fr = await createFriendRequest(req.userId, Number(receiver_id));
    res.status(201).json({ message: "Friend request sent", request: fr });      // new res created on server
  } catch (err) {
    console.error("Send friend request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });     // Internal Server Error
  }
});


//# get all friend requests (incoming + outgoing) 
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const data = await getFriendRequestsForUser(req.userId);
    res.json(data);
  } catch (err) {
    console.error("List friend requests error:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  }
});


//# get only PENDING friend requests
router.get("/requests/pending", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // get all requests
    const { incoming, outgoing } = await getFriendRequestsForUser(userId);

    // filter for pending only
    const incomingPending = incoming.filter(r => r.status === "pending");
    const outgoingPending = outgoing.filter(r => r.status === "pending");

    res.json({ incoming: incomingPending, outgoing: outgoingPending });
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  }
});


//# accept a friend request
router.post("/requests/:id/accept", authMiddleware, async (req, res) => {
  try {
    const updated = await updateFriendRequestStatus(req.params.id, req.userId, "accepted");
    res.json({ message: "Request accepted", request: updated });
  } catch (err) {
    console.error("Accept request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });     // Internal Server Error
  }
});


//# reject a friend request
router.post("/requests/:id/reject", authMiddleware, async (req, res) => {
  try {
    const updated = await updateFriendRequestStatus(req.params.id, req.userId, "rejected");
    res.json({ message: "Request rejected", request: updated });
  } catch (err) {
    console.error("Reject request error:", err);
    res.status(err.status || 500).json({ message: err.message || "Server error" });     // Internal Server Error
  }
});


//# get friendship/request status with another user
router.get("/status/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const otherId = Number(req.params.id);

  try {
    // check if already friends
    const friends = await getAllFriends(userId);
    if (friends.some(f => f.id === otherId)) {
      return res.json({ status: "friends", requestId: null });
    }

    // check friend_requests table for relation
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

      const fr = frRes.rows[0];     // latest one

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

      // if rejected -> allow sending again
      if (fr.status === "rejected") {
        return res.json({ status: "none", requestId: null });
      }

      return res.json({ status: "none", requestId: null });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ message: "Server error" });     // Internal Server Error
  }
});

module.exports = router;
