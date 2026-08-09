import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";

// ============================================================
// GET ALL CHATS FOR LOGGED-IN USER
// ============================================================

export default function useChats(user) {
  const [chats, setChats] = useState([]);

  // ==========================================================
  // FETCH CHATS
  // ==========================================================

  const fetchChats = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const res = await api.get("/chats");

      const chatsData = res.data.map((chat) => {
        // ----------------------------------------------------
        // FIND FRIEND FOR ONE-TO-ONE CHAT
        // ----------------------------------------------------

        let friend = null;

        if (!chat.is_group && Array.isArray(chat.members)) {
          friend = chat.members.find(
            (member) => Number(member.id) !== Number(user.id),
          );
        }

        // ----------------------------------------------------
        // CHAT NAME
        // ----------------------------------------------------

        const name = chat.is_group
          ? chat.name
          : friend
            ? `Chat with ${friend.username}`
            : "Chat";

        // ----------------------------------------------------
        // NORMALIZE CHAT
        // ----------------------------------------------------

        return {
          id: chat.id,

          name,

          lastMessage: chat.lastMessage ?? chat.last_message ?? null,

          type: chat.is_group ? "group" : "friend",

          members: chat.members || [],

          friendId:
            chat.friendId ?? chat.friend_id ?? (friend ? friend.id : null),

          is_group: chat.is_group,

          isTemporary: false,

          unread_count: Number(chat.unread_count ?? 0),
        };
      });

      setChats(chatsData);
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  }, [user?.id]);

  // ==========================================================
  // INITIAL FETCH
  // ==========================================================

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // ==========================================================
  // RETURN
  // ==========================================================

  return [chats, setChats, fetchChats];
}
