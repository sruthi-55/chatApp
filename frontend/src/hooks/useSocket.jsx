import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getFriends } from "../api/friends";   // 🔥 fetch friends on socket events

export default function useSocket(
  user,
  activeChat,
  setChats,
  setChatMessages,
  setFriendStatus,
  setFriends
) {
  const socket = useRef(null);    // useRef - persists across re-renders

  useEffect(() => {
    if (!user) return;

    if (!socket.current) {
      // creates a new Socket.IO client and connects it to your backend server
      socket.current = io("http://localhost:5001", { withCredentials: true });
    }

    const handleConnect = () => {
      socket.current.emit("registerUser", user.id);     // tell backend who I am
    };  

    //# handle new chat message
    const handleNewMessage = (message) => {

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

    //# handle friend request events
    const handleFriendRequestSent = (req) => {
      setFriendStatus && setFriendStatus("pending");
    };

    const handleFriendRequestAccepted = async (req) => {
      setFriendStatus && setFriendStatus("friends");

      // 🔥 refresh friends list instantly
      if (setFriends) {
        try {
          const data = await getFriends("/friends");
          if (typeof setFriends === "function") {
            setFriends(data);
          } else if (setFriends.current) {
            setFriends.current(data);
          }
        } catch (err) {
          console.error("Failed to refresh friends list:", err);
        }
      }
    };

    const handleFriendRequestRejected = (req) => {
      setFriendStatus && setFriendStatus("none");
    };

    // socket listeners
    socket.current.on("connect", handleConnect);
    socket.current.on("newMessage", handleNewMessage);
    socket.current.on("friendRequest:sent", handleFriendRequestSent);
    socket.current.on("friendRequest:accepted", handleFriendRequestAccepted);
    socket.current.on("friendRequest:rejected", handleFriendRequestRejected);

    return () => {    // cleanup
      if (!socket.current) return;
      socket.current.off("connect", handleConnect);
      socket.current.off("newMessage", handleNewMessage);
      socket.current.off("friendRequest:sent", handleFriendRequestSent);
      socket.current.off("friendRequest:accepted", handleFriendRequestAccepted);
      socket.current.off("friendRequest:rejected", handleFriendRequestRejected);
      socket.current.disconnect();
      socket.current = null; // reset for next mount
    };
  }, [user, activeChat, setChats, setChatMessages, setFriendStatus, setFriends]);

  return socket; // always return the ref
}
