import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getFriends } from "../api/friends";

export default function useSocket(
  user,
  activeChat,
  setChats,
  setFriendStatus,
  setFriends,
) {
  const socket = useRef(null);

  // ============================================================
  // KEEP LATEST ACTIVE CHAT
  // ============================================================

  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;

    console.log("activeChatRef updated:", activeChat?.id ?? null);
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

    // ==========================================================
    // CONNECT
    // ==========================================================

    const handleConnect = () => {
      console.log("Socket connected:", socketInstance.id);

      socketInstance.emit("registerUser", user.id);
    };

    // ==========================================================
    // NEW MESSAGE
    // ==========================================================

    const handleNewMessage = (message) => {
      const chatId = message.chat_id ?? message.chatId;

      if (!chatId) {
        console.warn("Message does not contain chat id:", message);

        return;
      }

      const content = message.content ?? message.text ?? "";

      const senderId = Number(message.sender_id ?? message.senderId);

      const currentUserId = Number(user.id);

      // ========================================================
      // GET CURRENT ACTIVE CHAT
      // ========================================================

      const currentActiveChat = activeChatRef.current;

      const activeChatId = currentActiveChat?.id ?? null;

      const isChatOpen =
        currentActiveChat != null &&
        String(currentActiveChat.id) === String(chatId);

      const isOwnMessage = senderId === currentUserId;

      console.log("========== SOCKET MESSAGE ==========");

      console.log({
        chatId,
        senderId,
        currentUserId,
        activeChatId,
        isChatOpen,
        isOwnMessage,
        message,
      });

      // ========================================================
      // UPDATE CHATS
      // ========================================================

      setChats((prevChats) => {
        console.log("Chats BEFORE socket update:", prevChats);

        const existingChat = prevChats.find(
          (chat) => String(chat.id) === String(chatId),
        );

        // ======================================================
        // CHAT DOES NOT EXIST
        // ======================================================

        if (!existingChat) {
          const unreadCount = !isOwnMessage && !isChatOpen ? 1 : 0;

          const newChat = {
            id: chatId,

            members: message.members || [],

            name: message.chatName || null,

            lastMessage: content,

            type: message.type || "friend",

            is_group: message.is_group ?? message.isGroup ?? false,

            friendId: message.friendId ?? message.friend_id ?? null,

            isTemporary: false,

            unread_count: unreadCount,
          };

          console.log("Creating chat from socket:", newChat);

          return [newChat, ...prevChats];
        }

        // ======================================================
        // CHAT EXISTS
        // ======================================================

        return prevChats.map((chat) => {
          if (String(chat.id) !== String(chatId)) {
            return chat;
          }

          const currentUnreadCount = Number(chat.unread_count ?? 0);

          let newUnreadCount = currentUnreadCount;

          // ==================================================
          // INCOMING MESSAGE
          // CHAT IS NOT OPEN
          //
          // Scenario 1:
          //
          // friendsChat visible
          // conversation NOT open
          //
          // => increment unread count
          // ==================================================

          if (!isOwnMessage && !isChatOpen) {
            newUnreadCount = currentUnreadCount + 1;

            console.log("INCREMENTING UNREAD COUNT", {
              chatId,
              previous: currentUnreadCount,
              new: newUnreadCount,
            });
          }

          // ==================================================
          // INCOMING MESSAGE
          // CHAT IS OPEN
          //
          // Scenario 2:
          //
          // conversation currently open
          //
          // => no unread messages
          // ==================================================

          if (!isOwnMessage && isChatOpen) {
            newUnreadCount = 0;

            console.log("CHAT IS OPEN -> unread = 0");
          }

          // ==================================================
          // OWN MESSAGE
          //
          // Sender should not receive unread count
          // for their own message.
          // ==================================================

          if (isOwnMessage) {
            newUnreadCount = currentUnreadCount;

            console.log("OWN MESSAGE -> unread unchanged");
          }

          const updatedChat = {
            ...chat,

            lastMessage: content,

            isTemporary: false,

            unread_count: newUnreadCount,
          };

          console.log("Updated chat:", updatedChat);

          return updatedChat;
        });
      });
    };

    // ==========================================================
    // FRIEND REQUEST SENT
    // ==========================================================

    const handleFriendRequestSent = () => {
      if (setFriendStatus) {
        setFriendStatus("pending");
      }
    };

    // ==========================================================
    // FRIEND REQUEST ACCEPTED
    // ==========================================================

    const handleFriendRequestAccepted = async () => {
      if (setFriendStatus) {
        setFriendStatus("friends");
      }

      if (!setFriends) {
        return;
      }

      try {
        const data = await getFriends("/friends");

        setFriends(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to refresh friends list:", err);
      }
    };

    // ==========================================================
    // FRIEND REQUEST REJECTED
    // ==========================================================

    const handleFriendRequestRejected = () => {
      if (setFriendStatus) {
        setFriendStatus("none");
      }
    };

    // ==========================================================
    // REGISTER EVENTS
    // ==========================================================

    socketInstance.on("connect", handleConnect);

    socketInstance.on("newMessage", handleNewMessage);

    socketInstance.on("friendRequestSent", handleFriendRequestSent);

    socketInstance.on("friendRequestAccepted", handleFriendRequestAccepted);

    socketInstance.on("friendRequestRejected", handleFriendRequestRejected);

    // ==========================================================
    // ALREADY CONNECTED
    // ==========================================================

    if (socketInstance.connected) {
      handleConnect();
    }

    // ==========================================================
    // CLEANUP
    // ==========================================================

    return () => {
      console.log("Cleaning up socket:", socketInstance.id);

      socketInstance.off("connect", handleConnect);

      socketInstance.off("newMessage", handleNewMessage);

      socketInstance.off("friendRequestSent", handleFriendRequestSent);

      socketInstance.off("friendRequestAccepted", handleFriendRequestAccepted);

      socketInstance.off("friendRequestRejected", handleFriendRequestRejected);

      socketInstance.disconnect();

      if (socket.current === socketInstance) {
        socket.current = null;
      }
    };
  }, [user?.id, setChats, setFriendStatus, setFriends]);

  return socket;
}
