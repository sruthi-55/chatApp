import { useState, useEffect } from "react";
import api from "../api/axios";

//# get all chats for logged-in user
export default function useChats(user) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    api.get("/chats")
      .then((res) => {

        const chatsData = res.data.map((chat) => {
          // determine friend for 1:1 chat
          let friend = null;
          if (!chat.is_group && chat.members) {
            friend = chat.members.find((m) => m.id !== user.id);
          }

          // generate chat name
          const name = chat.is_group
            ? chat.name
            : friend
            ? `Chat with ${friend.username}`
            : "Chat";

          return {
            id: chat.id,
            name,
            lastMessage: chat.lastMessage || null,
            type: chat.is_group ? "group" : "friend",
            members: chat.members || [],
            friendId: chat.friendId || (friend ? friend.id : null),
          };
        });
        setChats(chatsData);
      })
      .catch((err) => console.error("Failed to fetch chats:", err));
  }, [user]);

  return [chats, setChats];
}
