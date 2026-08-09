const pool = require("../utils/db");

// ============================================================
// GET MESSAGES FOR A CHAT
//
// Returns newest messages first from DB,
// then reverses them so frontend receives:
//
// oldest → newest
// ============================================================

async function getMessagesByChatId(chatId, limit = 20, beforeId) {
  const client = await pool.connect();

  try {
    const parsedLimit = Number(limit) || 20;

    const parsedBeforeId = beforeId ? Number(beforeId) : null;

    let sqlQuery;
    let params;

    // ========================================================
    // Pagination
    // ========================================================

    if (parsedBeforeId) {
      sqlQuery = `
        SELECT
          m.id,
          m.content,
          m.sender_id,
          m.chat_id,
          m.created_at,
          u.username,
          u.avatar
        FROM messages m
        JOIN users u
          ON m.sender_id = u.id
        WHERE
          m.chat_id = $1
          AND m.id < $2
        ORDER BY
          m.created_at DESC
        LIMIT $3
      `;

      params = [Number(chatId), parsedBeforeId, parsedLimit];
    } else {
      sqlQuery = `
        SELECT
          m.id,
          m.content,
          m.sender_id,
          m.chat_id,
          m.created_at,
          u.username,
          u.avatar
        FROM messages m
        JOIN users u
          ON m.sender_id = u.id
        WHERE
          m.chat_id = $1
        ORDER BY
          m.created_at DESC
        LIMIT $2
      `;

      params = [Number(chatId), parsedLimit];
    }

    const result = await client.query(sqlQuery, params);

    // DB result:
    // newest → oldest
    //
    // Frontend needs:
    // oldest → newest

    return result.rows.reverse();
  } finally {
    client.release();
  }
}

// ============================================================
// INSERT MESSAGE
// ============================================================

async function createMessage(chatId, senderId, content) {
  const client = await pool.connect();

  try {
    const sqlQuery = `
      INSERT INTO messages
        (
          chat_id,
          sender_id,
          content
        )
      VALUES
        (
          $1,
          $2,
          $3
        )
      RETURNING
        id,
        chat_id,
        sender_id,
        content,
        created_at
    `;

    const result = await client.query(sqlQuery, [
      Number(chatId),
      Number(senderId),
      content,
    ]);

    return result.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  getMessagesByChatId,
  createMessage,
};
