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

  // Keep the latest active chat without recreating
  // the socket connection.
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

    /*
     * IMPORTANT:
     *
     * The socket should be created only once for the current user.
     *
     * We depend on user.id instead of the complete user object.
     * This prevents the socket from being recreated when some
     * unrelated user state changes.
     */

    const socketInstance = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true,
    });

    socket.current = socketInstance;

    // ============================================================
    // SOCKET CONNECTED
    // ============================================================

    const handleConnect = () => {
      console.log("Socket connected:", socketInstance.id);

      socketInstance.emit("registerUser", user.id);
    };

    // ============================================================
    // NEW MESSAGE
    //
    // IMPORTANT:
    //
    // This handler ONLY updates the CHAT LIST.
    //
    // It does NOT update chatMessages.
    //
    // ChatWindow is responsible for displaying messages.
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

        // ========================================================
        // CHAT DOES NOT EXIST IN CURRENT CHAT LIST
        // ========================================================

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

        // ========================================================
        // CHAT ALREADY EXISTS
        // ========================================================

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
    //
    // Some socket implementations emit "messageSent" separately.
    //
    // We use the same chat-list update logic.
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
    // REGISTER EVENT LISTENERS
    // ============================================================

    socketInstance.on("connect", handleConnect);

    socketInstance.on("newMessage", handleNewMessage);

    socketInstance.on("messageSent", handleMessageSent);

    socketInstance.on("friendRequestSent", handleFriendRequestSent);

    socketInstance.on("friendRequestAccepted", handleFriendRequestAccepted);

    socketInstance.on("friendRequestRejected", handleFriendRequestRejected);

    // ============================================================
    // IF ALREADY CONNECTED
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
