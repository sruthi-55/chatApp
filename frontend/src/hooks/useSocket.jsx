import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getFriends } from "../api/friends";

export default function useSocket(
  user,
  activeChat,
  setChats,
  setChatMessages,
  setFriendStatus,
  setFriends,
) {
  const socket = useRef(null);

  // Keep latest active chat available if needed later.
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // ============================================================
  // CREATE SOCKET CONNECTION
  // ============================================================

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const socketInstance = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true,
    });

    socket.current = socketInstance;

    // ============================================================
    // CONNECT
    // ============================================================

    const handleConnect = () => {
      console.log("Socket connected:", socketInstance.id);

      socketInstance.emit("registerUser", Number(user.id));
    };

    // ============================================================
    // NEW MESSAGE
    //
    // This updates CHAT LIST only.
    //
    // ChatWindow handles actual chatMessages.
    // ============================================================

    const handleNewMessage = (message) => {
      const chatId = message.chat_id ?? message.chatId;

      if (!chatId) {
        return;
      }

      const content = message.content ?? message.text ?? "";

      setChats((prevChats) => {
        const existingChat = prevChats.find(
          (chat) => String(chat.id) === String(chatId),
        );

        if (!existingChat) {
          return [
            {
              id: chatId,
              members: message.members || [],
              name: message.chatName || "Direct Chat",
              lastMessage: content,
              type: message.type || "friend",
              is_group: message.is_group ?? false,
              friendId: message.friendId ?? null,
              isTemporary: false,
            },
            ...prevChats,
          ];
        }

        return prevChats.map((chat) =>
          String(chat.id) === String(chatId)
            ? {
                ...chat,
                lastMessage: content,
                isTemporary: false,
              }
            : chat,
        );
      });
    };

    // ============================================================
    // MESSAGE SENT
    // ============================================================

    const handleMessageSent = (message) => {
      handleNewMessage(message);
    };

    // ============================================================
    // FRIEND REQUEST SENT
    // ============================================================

    const handleFriendRequestSent = () => {
      if (setFriendStatus) {
        setFriendStatus("pending");
      }
    };

    // ============================================================
    // FRIEND REQUEST ACCEPTED
    // ============================================================

    const handleFriendRequestAccepted = async () => {
      if (setFriendStatus) {
        setFriendStatus("friends");
      }

      if (!setFriends) {
        return;
      }

      try {
        const data = await getFriends("/friends");

        setFriends(data);
      } catch (err) {
        console.error("Failed to refresh friends list:", err);
      }
    };

    // ============================================================
    // FRIEND REQUEST REJECTED
    // ============================================================

    const handleFriendRequestRejected = () => {
      if (setFriendStatus) {
        setFriendStatus("none");
      }
    };

    // ============================================================
    // REGISTER EVENTS
    // ============================================================

    socketInstance.on("connect", handleConnect);

    socketInstance.on("newMessage", handleNewMessage);

    socketInstance.on("messageSent", handleMessageSent);

    socketInstance.on("friendRequestSent", handleFriendRequestSent);

    socketInstance.on("friendRequestAccepted", handleFriendRequestAccepted);

    socketInstance.on("friendRequestRejected", handleFriendRequestRejected);

    // ============================================================
    // ALREADY CONNECTED
    // ============================================================

    if (socketInstance.connected) {
      handleConnect();
    }

    // ============================================================
    // CLEANUP
    // ============================================================

    return () => {
      socketInstance.off("connect", handleConnect);

      socketInstance.off("newMessage", handleNewMessage);

      socketInstance.off("messageSent", handleMessageSent);

      socketInstance.off("friendRequestSent", handleFriendRequestSent);

      socketInstance.off("friendRequestAccepted", handleFriendRequestAccepted);

      socketInstance.off("friendRequestRejected", handleFriendRequestRejected);

      socketInstance.disconnect();

      if (socket.current === socketInstance) {
        socket.current = null;
      }
    };
  }, [user?.id, setChats, setChatMessages, setFriendStatus, setFriends]);

  return socket;
}
