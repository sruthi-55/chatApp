const pool = require("../utils/db");
const { getUserById } = require("./User");

//# fetch all chats for a user along with last message
//# fetch all chats for a user along with last message
async function getUserChats(userId) {
  const client = await pool.connect();
  try {
    // ensure userId is number
    userId = Number(userId);

    const sqlQuery = `
      SELECT 
        c.id, 
        c.name, 
        c.is_group,
        c.members,   
        lm.id as last_message_id,
        lm.content as last_message_content,
        lm.sender_id as last_message_sender
      FROM chats c
      LEFT JOIN LATERAL (
          SELECT * FROM messages m
          WHERE m.chat_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
      ) lm ON true
      WHERE $1 = ANY(c.members)
      ORDER BY lm.created_at DESC NULLS LAST
    `;
    const res = await client.query(sqlQuery, [userId]);


    // map member IDs to full user objects and include friendId
    const chatsWithMembers = await Promise.all(
      res.rows.map(async (chat) => {
        const memberIds = chat.members || []; // fallback if null

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

        // fetch full user info
        const { rows: members } = await client.query(
          `SELECT id, username, avatar, email FROM users WHERE id = ANY($1)`,
          [memberIds]
        );

        

        // determine friendId for 1:1 chat
        let friendId = null;
        if (!chat.is_group && members.length > 0) {
          const friend = members.find((m) => m.id !== userId);
          friendId = friend?.id || null;
        }

        // structure lastMessage
        const lastMessage = chat.last_message_id
          ? {
              id: chat.last_message_id,
              content: chat.last_message_content,
              senderId: chat.last_message_sender,
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
      })
    );

    return chatsWithMembers;
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
      SELECT c.id, c.members
      FROM chats c
      WHERE c.is_group = false
        AND $1 = ANY(c.members)
        AND $2 = ANY(c.members)
      LIMIT 1
    `;
    const checkRes = await client.query(checkSql, [user1Id, user2Id]);

    if (checkRes.rows.length > 0) {
      const membersQuery = await client.query(
        `SELECT id, username, avatar, email FROM users WHERE id = ANY($1)`,
        [checkRes.rows[0].members]
      );

      

      const friend = membersQuery.rows.find(m => m.id !== Number(user1Id));

      await client.query("COMMIT");

      return {
        id: checkRes.rows[0].id,
        members: membersQuery.rows,
        friendId: friend?.id || null, // always include friendId
        lastMessage: null, // can add last message if needed
      };
    }

    // create chat if not exists
    const insertChat = await client.query(
      `INSERT INTO chats (is_group, members) VALUES (false, $1) RETURNING id`,
      [[user1Id, user2Id]] // integer array
    );
    const chatId = insertChat.rows[0].id;

    // populate chat_members table if exists
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [chatId, user1Id, user2Id]
    );

    // fetch full user info for members
    const { rows: members } = await client.query(
      `SELECT id, username, avatar, email FROM users WHERE id = ANY($1)`,
      [[user1Id, user2Id]]
    );

    const friend = members.find(m => m.id !== Number(user1Id));

    await client.query("COMMIT");

    return {
      id: chatId,
      members,
      friendId: friend?.id || null, // always include friendId
      lastMessage: null,
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
  getChatMessages,
  createMessage,
  createOrGetDirectChat,
};
