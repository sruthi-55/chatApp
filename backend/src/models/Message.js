const pool = require("../utils/db");

async function getMessagesByChatId(chatId, userId, limit = 20, beforeId) {
  const client = await pool.connect();

  try {
    const parsedChatId = Number(chatId);
    const parsedUserId = Number(userId);
    const parsedLimit = Number(limit) || 20;
    const parsedBeforeId = beforeId ? Number(beforeId) : null;

    let sqlQuery;
    let params;

    // ========================================================
    // is_read LOGIC
    //
    // For OUR OWN message:
    //
    //   Has another user read it?
    //
    // For SOMEONE ELSE'S message:
    //
    //   Have WE read it?
    //
    // ========================================================

    const readStatusQuery = `
      CASE

        -- ==============================================
        -- Message sent by current user
        --
        -- Check whether ANY other user has read it.
        -- ==============================================

        WHEN m.sender_id = $2::integer THEN
          EXISTS (
            SELECT 1
            FROM message_reads mr
            WHERE mr.message_id = m.id
              AND mr.user_id != $2::bigint
          )

        -- ==============================================
        -- Message received from another user
        --
        -- Check whether CURRENT USER has read it.
        -- ==============================================

        ELSE
          EXISTS (
            SELECT 1
            FROM message_reads mr
            WHERE mr.message_id = m.id
              AND mr.user_id = $2::bigint
          )

      END AS is_read
    `;

    // ========================================================
    // PAGINATION
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
          u.avatar,

          ${readStatusQuery}

        FROM messages m

        JOIN users u
          ON m.sender_id = u.id

        WHERE
          m.chat_id = $1
          AND m.id < $3

        ORDER BY
          m.created_at DESC

        LIMIT $4
      `;

      params = [parsedChatId, parsedUserId, parsedBeforeId, parsedLimit];
    } else {
      sqlQuery = `
        SELECT
          m.id,
          m.content,
          m.sender_id,
          m.chat_id,
          m.created_at,
          u.username,
          u.avatar,

          ${readStatusQuery}

        FROM messages m

        JOIN users u
          ON m.sender_id = u.id

        WHERE
          m.chat_id = $1

        ORDER BY
          m.created_at DESC

        LIMIT $3
      `;

      params = [parsedChatId, parsedUserId, parsedLimit];
    }

    const result = await client.query(sqlQuery, params);

    // ========================================================
    // DB:
    // newest → oldest
    //
    // Frontend:
    // oldest → newest
    // ========================================================

    return result.rows.reverse();
  } finally {
    client.release();
  }
}

// ============================================================
// MARK MESSAGES AS READ
//
// messageIds = messages currently visible/loaded in frontend
//
// Only messages:
//   1. belonging to this chat
//   2. not sent by current user
//
// are marked as read.
//
// Returns the messages that were newly marked as read,
// grouped later by sender so Socket.IO can notify each sender.
// ============================================================

async function markMessagesAsRead(chatId, userId, messageIds) {
  const client = await pool.connect();

  try {
    const parsedChatId = Number(chatId);
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedChatId) || parsedChatId <= 0) {
      throw new Error("Invalid chat ID");
    }

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new Error("Invalid user ID");
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return [];
    }

    const parsedMessageIds = messageIds
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (parsedMessageIds.length === 0) {
      return [];
    }

    // ========================================================
    // INSERT READ RECORDS
    //
    // IMPORTANT:
    //
    // message_reads.user_id is BIGINT
    // messages.sender_id is INTEGER
    //
    // We explicitly cast $2 to INTEGER when comparing it
    // with messages.sender_id.
    //
    // We explicitly cast $2 to BIGINT when inserting into
    // message_reads.user_id.
    // ========================================================

    const sqlQuery = `
      INSERT INTO message_reads
        (
          message_id,
          user_id
        )

      SELECT
        m.id,
        $2::bigint

      FROM messages m

      WHERE
        m.id = ANY($3::bigint[])
        AND m.chat_id = $1::integer
        AND m.sender_id != $2::integer

      ON CONFLICT
        (
          message_id,
          user_id
        )
      DO NOTHING

      RETURNING
        message_id,
        user_id,
        read_at
    `;

    const result = await client.query(sqlQuery, [
      parsedChatId,
      parsedUserId,
      parsedMessageIds,
    ]);

    if (result.rows.length === 0) {
      return [];
    }

    // ========================================================
    // FIND SENDER OF EACH NEWLY READ MESSAGE
    // ========================================================

    const newlyReadIds = result.rows.map((row) => Number(row.message_id));

    const senderResult = await client.query(
      `
        SELECT
          id,
          sender_id

        FROM messages

        WHERE
          id = ANY($1::bigint[])
          AND chat_id = $2::integer
      `,
      [newlyReadIds, parsedChatId],
    );

    // ========================================================
    // message ID -> sender ID
    // ========================================================

    const senderMap = new Map();

    senderResult.rows.forEach((row) => {
      senderMap.set(Number(row.id), Number(row.sender_id));
    });

    // ========================================================
    // RETURN:
    //
    // [
    //   {
    //     messageId: 56,
    //     userId: 10,
    //     senderId: 9,
    //     readAt: ...
    //   }
    // ]
    // ========================================================

    return result.rows.map((row) => ({
      messageId: Number(row.message_id),
      userId: Number(row.user_id),
      senderId: senderMap.get(Number(row.message_id)),
      readAt: row.read_at,
    }));
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
    const result = await client.query(
      `
        INSERT INTO messages (
          chat_id,
          sender_id,
          content
        )

        VALUES (
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
      `,
      [Number(chatId), Number(senderId), content],
    );

    return {
      ...result.rows[0],
      is_read: false,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getMessagesByChatId,
  markMessagesAsRead,
  createMessage,
};
