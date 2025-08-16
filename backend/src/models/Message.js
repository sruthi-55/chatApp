const pool = require("../utils/db");

async function getMessagesByChatId(chatId, limit = 20, beforeId) {
  const client = await pool.connect();
  try {
    let sqlQuery;
    let params;

    // parse numbers safely
    const parsedLimit = Number(limit) || 20;
    const parsedBeforeId = beforeId ? Number(beforeId) : null;

    if (parsedBeforeId) {
      sqlQuery = `
        SELECT m.id, m.content, m.sender_id, m.chat_id, m.created_at,
               u.username, u.avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = $1 AND m.id < $2
        ORDER BY m.created_at DESC
        LIMIT $3
      `;
      params = [chatId, parsedBeforeId, parsedLimit];
    } else {
      sqlQuery = `
        SELECT m.id, m.content, m.sender_id, m.chat_id, m.created_at,
               u.username, u.avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
      params = [chatId, parsedLimit];
    }

    const res = await client.query(sqlQuery, params);
    return res.rows.reverse(); // oldest first
  } finally {
    client.release();
  }
}



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

module.exports = { getMessagesByChatId, createMessage };
