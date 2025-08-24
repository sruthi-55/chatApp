import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export default function useSocket(user, activeChat, setChats, setChatMessages) {
  const socket = useRef(null);    // useRef - persists across re-renders

  useEffect(() => {
    if (!user) return;

    // creates a new Socket.IO client and connects it to your backend server
    socket.current = io("http://localhost:5001", { withCredentials: true });

    const handleConnect = () => console.log("Socket connected:", socket.current.id);  

    const handleNewMessage = (message) => {
      console.log("Payload:", message);

      // Normalize chatId to match your chat state 'id'
      const chatId = message.chat_id ?? message.chatId;

      setChats(prevChats => {
        const chatExists = prevChats.some(c => c.id === chatId);
        let updatedChats = prevChats;

        if (!chatExists) {
          // Add new chat if doesn't exist
          updatedChats = [
            {
              id: chatId,
              members: message.members,
              name: message.chatName || "Direct Chat", // or whatever your backend sends
              lastMessage: message.content ?? message.text,
              type: message.type ?? "friend" // backend may send type/group flag
            },
            ...prevChats
          ];
        } else {
          // Update lastMessage if exists
          updatedChats = updatedChats.map(chat =>
            chat.id === chatId
              ? { ...chat, lastMessage: message.content ?? message.text }
              : chat
          );
        }
        return updatedChats;
      });

      if (activeChat?.id === chatId) {
        setChatMessages(prev => [...prev, message]);
      }
    };


    socket.current.on("connect", handleConnect);
    socket.current.on("newMessage", handleNewMessage);    // receive new message

    return () => {    // cleanup
      socket.current.off("connect", handleConnect);
      socket.current.off("newMessage", handleNewMessage);
      socket.current.disconnect();
    };
  }, [user, activeChat, setChats, setChatMessages]);

  return socket;
}
