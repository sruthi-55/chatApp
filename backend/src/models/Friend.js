const pool = require("../utils/db");

//# get all friends for logged-in user
async function getAllFriends(userId) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT u.id, u.username, u.email, u.full_name, u.avatar
      FROM friendships f
      JOIN users u ON u.id = f.user2_id
      WHERE f.user1_id = $1
      UNION
      SELECT u.id, u.username, u.email, u.full_name, u.avatar
      FROM friendships f
      JOIN users u ON u.id = f.user1_id
      WHERE f.user2_id = $1
      `,
      [userId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

//# create a friend request
async function createFriendRequest(senderId, receiverId) {
  if (!receiverId) throw new Error("receiverId required");

  if (Number(senderId) === Number(receiverId)) {
    const err = new Error("You cannot send a request to yourself");
    err.status = 400;     // Bad request
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // check receiver exists
    const userRes = await client.query("SELECT id FROM users WHERE id=$1", [receiverId]);
    if (userRes.rows.length === 0) {
      const err = new Error("Receiver not found");
      err.status = 404;     // Not found
      throw err;
    }

    // check for existing pending request
    const pendingCheck = await client.query(
      `SELECT id FROM friend_requests WHERE sender_id=$1 AND receiver_id=$2 AND status='pending'`,
      [senderId, receiverId]
    );
    if (pendingCheck.rows.length > 0) {
      const err = new Error("Friend request already sent");
      err.status = 400;     // Bad request
      throw err;
    }

    // insert new request into friend_requests
    const insertRes = await client.query(
      `INSERT INTO friend_requests (sender_id, receiver_id)
       VALUES ($1, $2)
       RETURNING id, sender_id, receiver_id, status, created_at`,
      [senderId, receiverId]
    );

    await client.query("COMMIT");
    return insertRes.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

//# get all friend requests for a user (incoming + outgoing)
async function getFriendRequestsForUser(userId) {
  const client = await pool.connect();
  try {
    const sql = `
      SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at, fr.responded_at,
             su.username  AS sender_username,   su.avatar  AS sender_avatar,
             ru.username  AS receiver_username, ru.avatar  AS receiver_avatar
      FROM friend_requests fr
      JOIN users su ON su.id = fr.sender_id
      JOIN users ru ON ru.id = fr.receiver_id
      WHERE fr.sender_id = $1 OR fr.receiver_id = $1
      ORDER BY fr.created_at DESC
    `;
    const { rows } = await client.query(sql, [userId]);

    const incoming = [];
    const outgoing = [];

    for (const r of rows) {
      const shaped = {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        responded_at: r.responded_at,
        sender: {
          id: r.sender_id,
          username: r.sender_username,
          avatar: r.sender_avatar,
        },
        receiver: {
          id: r.receiver_id,
          username: r.receiver_username,
          avatar: r.receiver_avatar,
        },
      };

      if (r.receiver_id === Number(userId)) incoming.push(shaped);
      if (r.sender_id === Number(userId)) outgoing.push(shaped);
    }

    return { incoming, outgoing };
  } finally {
    client.release();
  }
}

//# accept or reject a request
async function updateFriendRequestStatus(requestId, userId, newStatus) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const frRes = await client.query(
      `SELECT id, sender_id, receiver_id, status FROM friend_requests WHERE id=$1`,
      [requestId]
    );

    if (frRes.rows.length === 0) {
      const err = new Error("Request not found");
      err.status = 404;
      throw err;
    }

    const fr = frRes.rows[0];
    if (fr.receiver_id !== Number(userId)) {
      const err = new Error("Not authorized to update this request");
      err.status = 403;
      throw err;
    }
    if (fr.status !== "pending") {
      const err = new Error("Request already processed");
      err.status = 400;
      throw err;
    }

    // update friend request status
    const updRes = await client.query(
      `UPDATE friend_requests
       SET status=$1, responded_at=NOW()
       WHERE id=$2
       RETURNING id, sender_id, receiver_id, status, created_at, responded_at`,
      [newStatus, requestId]
    );

    if (newStatus === "accepted") {
      await client.query(
        `INSERT INTO friendships (user1_id, user2_id)
         VALUES ($1, $2)
         ON CONFLICT (user1_id, user2_id) DO NOTHING`,
        [fr.sender_id, fr.receiver_id]
      );
      await client.query(
        `INSERT INTO friendships (user1_id, user2_id)
         VALUES ($1, $2)
         ON CONFLICT (user1_id, user2_id) DO NOTHING`,
        [fr.receiver_id, fr.sender_id]
      );

      //# create 1-on-1 chat for the two users
      const chatRes = await client.query(
        `INSERT INTO chats (name, is_group, created_by, members)
         VALUES ($1, FALSE, $2, $3)
         RETURNING id, name, is_group, created_by, members`,
        [
          null,
          fr.sender_id,
          [fr.sender_id, fr.receiver_id], // integer array now
        ]
      );

      const chatId = chatRes.rows[0].id;

      await client.query(
        `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [chatId, fr.sender_id, fr.receiver_id]
      );
    }

    await client.query("COMMIT");
    return updRes.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  createFriendRequest,
  getFriendRequestsForUser,
  updateFriendRequestStatus,
  getAllFriends,
};
