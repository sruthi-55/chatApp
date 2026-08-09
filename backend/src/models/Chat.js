const pool = require("../utils/db");

// ============================================================
// GET ALL CHATS FOR A USER
//
// IMPORTANT:
//
// Only chats that have at least one message are returned.
//
// Therefore:
//   - empty chats are not returned
//   - temporary chats are not returned
//   - old empty chats are also hidden
// ============================================================

async function getUserChats(userId) {
  const client = await pool.connect();

  try {
    userId = Number(userId);

    const sqlQuery = `
      SELECT
        c.id,
        c.name,
        c.is_group,
        c.members,

        lm.id AS last_message_id,
        lm.content AS last_message_content,
        lm.sender_id AS last_message_sender,
        lm.created_at AS last_message_created_at

      FROM chats c

      JOIN LATERAL (
        SELECT
          m.id,
          m.content,
          m.sender_id,
          m.created_at
        FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true

      WHERE $1 = ANY(c.members)

      ORDER BY
        lm.created_at DESC
    `;

    const result = await client.query(sqlQuery, [userId]);

    const chatsWithMembers = await Promise.all(
      result.rows.map(async (chat) => {
        const memberIds = chat.members || [];

        if (!memberIds.length) {
          return {
            id: chat.id,
            name: chat.name,
            is_group: chat.is_group,
            members: [],
            friendId: null,
            lastMessage: null,
          };
        }

        // ==================================================
        // Fetch complete member details
        // ==================================================

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

        // ==================================================
        // Determine friend in 1-to-1 chat
        // ==================================================

        let friendId = null;

        if (!chat.is_group && members.length > 0) {
          const friend = members.find(
            (member) => Number(member.id) !== Number(userId),
          );

          friendId = friend?.id || null;
        }

        // ==================================================
        // Last message
        // ==================================================

        const lastMessage = chat.last_message_id
          ? {
              id: chat.last_message_id,

              content: chat.last_message_content,

              senderId: chat.last_message_sender,

              createdAt: chat.last_message_created_at,
            }
          : null;

        return {
          id: chat.id,
          name: chat.name,
          is_group: chat.is_group,
          members,
          friendId,
          lastMessage,
        };
      }),
    );

    return chatsWithMembers;
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
//
// Kept for places that explicitly need to create a chat.
//
// IMPORTANT:
//
// This function can create an empty chat.
//
// Therefore it should NOT be called merely when the user
// opens a friend without sending a message.
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
//
// THIS IS THE IMPORTANT FUNCTION.
//
// Transaction:
//
// BEGIN
//   ↓
// Find existing direct chat
//   ↓
// Create chat if necessary
//   ↓
// Insert first message
//   ↓
// Fetch members
//   ↓
// COMMIT
//
// Any failure:
//
// ROLLBACK
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
    // 1. Find existing direct chat
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
    // 2. Existing chat
    // ========================================================

    if (checkResult.rows.length > 0) {
      chatId = checkResult.rows[0].id;

      memberIds = checkResult.rows[0].members || [senderId, receiverId];
    }

    // ========================================================
    // 3. Create new chat
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

      // ======================================================
      // Populate chat_members
      // ======================================================

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
    // 4. Insert message
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
    // 5. Fetch members
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
    // 6. Build chat object
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
    };

    // ========================================================
    // 7. Commit transaction
    // ========================================================

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
  createMessage,
  createOrGetDirectChat,
  createDirectChatWithMessage,
};
