const pool = require("../utils/db");

// ============================================================
// GET ALL CHATS FOR USER
//
// Returns:
//   - chat information
//   - members
//   - last message
//   - unread message count
//
// unread_count:
//
//   messages in this chat
//   AND not sent by current user
//   AND not present in message_reads for current user
// ============================================================

async function getUserChats(userId) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT
        c.id,
        c.name,
        c.is_group,

        -- ====================================================
        -- CHAT MEMBERS
        -- ====================================================

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', u.id,
                'username', u.username,
                'avatar', u.avatar,
                'email', u.email
              )
            )
            FROM users u
            WHERE u.id = ANY(c.members)
          ),
          '[]'::json
        ) AS members,

        -- ====================================================
        -- LAST MESSAGE
        -- ====================================================

        COALESCE(
          (
            SELECT m.content
            FROM messages m
            WHERE m.chat_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ),
          ''
        ) AS last_message,

        -- ====================================================
        -- UNREAD MESSAGE COUNT
        -- ====================================================

        (
          SELECT COUNT(*)
          FROM messages m
          WHERE
            m.chat_id = c.id

            -- Don't count our own messages
            AND m.sender_id != $1

            -- Message hasn't been read by current user
            AND NOT EXISTS (
              SELECT 1
              FROM message_reads mr
              WHERE
                mr.message_id = m.id
                AND mr.user_id = $1
            )
        )::integer AS unread_count

      FROM chats c

      INNER JOIN chat_members cm
        ON cm.chat_id = c.id

      WHERE cm.user_id = $1

      ORDER BY
        (
          SELECT MAX(m.created_at)
          FROM messages m
          WHERE m.chat_id = c.id
        ) DESC NULLS LAST
      `,
      [Number(userId)],
    );

    return result.rows;
  } finally {
    client.release();
  }
}

// ============================================================
// GET MEMBERS OF A CHAT
//
// Used by Socket.IO.
//
// We need this because a user who isn't currently viewing
// the chat has NOT joined that chat's Socket.IO room.
//
// Therefore the server must know which users should receive
// the new-message event directly.
// ============================================================

async function getChatMemberIds(chatId) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT user_id
      FROM chat_members
      WHERE chat_id = $1
      `,
      [Number(chatId)],
    );

    return result.rows.map((row) => Number(row.user_id));
  } finally {
    client.release();
  }
}

// ============================================================
// CREATE MESSAGE IN EXISTING CHAT
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

// ============================================================
// CREATE OR GET DIRECT CHAT
// ============================================================

async function createOrGetDirectChat(user1Id, user2Id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    user1Id = Number(user1Id);
    user2Id = Number(user2Id);

    if (!user1Id || !user2Id) {
      throw new Error("Invalid user IDs");
    }

    if (user1Id === user2Id) {
      throw new Error("Cannot chat with yourself");
    }

    // ========================================================
    // Check existing direct chat
    // ========================================================

    const checkSql = `
      SELECT
        c.id,
        c.members
      FROM chats c
      WHERE c.is_group = false
        AND $1 = ANY(c.members)
        AND $2 = ANY(c.members)
      LIMIT 1
    `;

    const checkResult = await client.query(checkSql, [user1Id, user2Id]);

    if (checkResult.rows.length > 0) {
      const chat = checkResult.rows[0];

      const { rows: members } = await client.query(
        `
        SELECT
          id,
          username,
          avatar,
          email
        FROM users
        WHERE id = ANY($1)
        `,
        [chat.members],
      );

      const friend = members.find((member) => Number(member.id) !== user1Id);

      await client.query("COMMIT");

      return {
        id: chat.id,
        members,
        friendId: friend?.id || null,
        lastMessage: null,
      };
    }

    // ========================================================
    // Create new chat
    // ========================================================

    const memberIds = [user1Id, user2Id];

    const insertChat = await client.query(
      `
      INSERT INTO chats
        (
          is_group,
          members
        )
      VALUES
        (
          false,
          $1
        )
      RETURNING id
      `,
      [memberIds],
    );

    const chatId = insertChat.rows[0].id;

    // ========================================================
    // Populate chat_members
    // ========================================================

    await client.query(
      `
      INSERT INTO chat_members
        (
          chat_id,
          user_id
        )
      VALUES
        (
          $1,
          $2
        ),
        (
          $1,
          $3
        )
      `,
      [chatId, user1Id, user2Id],
    );

    // ========================================================
    // Fetch members
    // ========================================================

    const { rows: members } = await client.query(
      `
      SELECT
        id,
        username,
        avatar,
        email
      FROM users
      WHERE id = ANY($1)
      `,
      [memberIds],
    );

    const friend = members.find((member) => Number(member.id) !== user1Id);

    await client.query("COMMIT");

    return {
      id: chatId,
      members,
      friendId: friend?.id || null,
      lastMessage: null,
    };
  } catch (err) {
    await client.query("ROLLBACK");

    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// CREATE DIRECT CHAT + FIRST MESSAGE
// ============================================================

async function createDirectChatWithMessage(senderId, receiverId, content) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    senderId = Number(senderId);
    receiverId = Number(receiverId);

    if (!senderId || !receiverId) {
      throw new Error("Invalid user IDs");
    }

    if (senderId === receiverId) {
      throw new Error("Cannot chat with yourself");
    }

    // ========================================================
    // Find existing direct chat
    // ========================================================

    const checkSql = `
      SELECT
        c.id,
        c.members
      FROM chats c
      WHERE c.is_group = false
        AND $1 = ANY(c.members)
        AND $2 = ANY(c.members)
      LIMIT 1
    `;

    const checkResult = await client.query(checkSql, [senderId, receiverId]);

    let chatId;
    let memberIds;

    // ========================================================
    // Existing chat
    // ========================================================

    if (checkResult.rows.length > 0) {
      chatId = checkResult.rows[0].id;

      memberIds = checkResult.rows[0].members || [senderId, receiverId];
    }

    // ========================================================
    // Create new chat
    // ========================================================
    else {
      memberIds = [senderId, receiverId];

      const insertChat = await client.query(
        `
        INSERT INTO chats
          (
            is_group,
            members
          )
        VALUES
          (
            false,
            $1
          )
        RETURNING id
        `,
        [memberIds],
      );

      chatId = insertChat.rows[0].id;

      await client.query(
        `
        INSERT INTO chat_members
          (
            chat_id,
            user_id
          )
        VALUES
          (
            $1,
            $2
          ),
          (
            $1,
            $3
          )
        `,
        [chatId, senderId, receiverId],
      );
    }

    // ========================================================
    // Insert message
    // ========================================================

    const messageResult = await client.query(
      `
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
      `,
      [chatId, senderId, content],
    );

    const message = messageResult.rows[0];

    // ========================================================
    // Fetch members
    // ========================================================

    const { rows: members } = await client.query(
      `
      SELECT
        id,
        username,
        avatar,
        email
      FROM users
      WHERE id = ANY($1)
      `,
      [memberIds],
    );

    const friend = members.find((member) => Number(member.id) !== senderId);

    // ========================================================
    // Build chat object
    // ========================================================

    const chat = {
      id: chatId,

      name: null,

      is_group: false,

      members,

      friendId: friend?.id || null,

      lastMessage: {
        id: message.id,
        content: message.content,
        senderId: message.sender_id,
        createdAt: message.created_at,
      },

      unread_count: 0,
    };

    await client.query("COMMIT");

    return {
      chat,
      message,
    };
  } catch (err) {
    await client.query("ROLLBACK");

    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getUserChats,
  getChatMemberIds,
  createMessage,
  createOrGetDirectChat,
  createDirectChatWithMessage,
};
