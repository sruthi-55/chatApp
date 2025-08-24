import { useState, useEffect } from "react";
import api from "../api/axios";

//# get all chats for logged-in user
export default function useChats(user) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    api.get("/chats")
      .then((res) => {
        const chatsData = res.data.map((chat) => ({
          id: chat.id,
          name: chat.is_group
            ? chat.name
            : `Chat with ${chat.memberids.find((id) => id !== user.id)}`,
          lastMessage: chat.last_message_content || "",
          type: chat.is_group ? "group" : "friend",
        }));
        setChats(chatsData);
      })
      .catch((err) => console.error("Failed to fetch chats:", err));
  }, [user]);

  return [chats, setChats];
}
