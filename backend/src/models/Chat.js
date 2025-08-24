const pool = require("../utils/db");

//# fetch all chats for a user along with last message
async function getUserChats(userId) {
  const client = await pool.connect();
  try {
    const sqlQuery = `
      SELECT c.id, c.name, c.is_group,
             json_agg(cm.user_id) as memberIds,   
             lm.id as last_message_id,
             lm.content as last_message_content,
             lm.sender_id as last_message_sender
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      LEFT JOIN LATERAL (
        SELECT * FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true
      WHERE cm.user_id = $1   
      GROUP BY c.id, lm.id, lm.content, lm.sender_id
      ORDER BY lm.id DESC NULLS LAST
    `;
    const res = await client.query(sqlQuery, [userId]);
    return res.rows;
  } finally {
    client.release();
  }
}


//# fetch messages of a chat in chronological order
async function getChatMessages(chatId) {
  const client = await pool.connect();
  try {
    const sqlQuery = `
      SELECT id, sender_id, content, created_at
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
    `;
    const res = await client.query(sqlQuery, [chatId]);
    return res.rows;
  } finally {
    client.release();
  }
}


//# create a new message 
async function createMessage(chatId, senderId, content) {
  const client = await pool.connect();
  try {
    const sqlQuery = `
      INSERT INTO messages (chat_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, chat_id, sender_id, content, created_at
    `;
    const res = await client.query(sqlQuery, [chatId, senderId, content]);
    return res.rows[0];
  } finally {
    client.release();
  }
}


//# create/get a direct chat between two users 
async function createOrGetDirectChat(user1Id, user2Id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // check if chat already exists with both members
    const checkSql = `
      SELECT c.id
      FROM chats c
      JOIN chat_members m1 ON c.id = m1.chat_id AND m1.user_id = $1
      JOIN chat_members m2 ON c.id = m2.chat_id AND m2.user_id = $2
      WHERE c.is_group = false
      LIMIT 1
    `;
    const checkRes = await client.query(checkSql, [user1Id, user2Id]);

    if (checkRes.rows.length > 0) {
      await client.query("COMMIT");
      return checkRes.rows[0]; // existing chat
    }

    // create chat
    const insertChat = await client.query(
      `INSERT INTO chats (is_group) VALUES (false) RETURNING id`
    );
    const chatId = insertChat.rows[0].id;

    // add both users as members
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chatId, user1Id, user2Id]
    );

    await client.query("COMMIT");
    return { id: chatId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getUserChats, getChatMessages, createMessage, createOrGetDirectChat };
