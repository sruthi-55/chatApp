import { useState, useEffect, useRef } from "react";

import styles from "./ChatWindow.module.css";

import api from "../api/axios";

import { acceptFriendRequest, rejectFriendRequest } from "../api/friends";

export default function ChatWindow({
  activeChat,
  chatMessages,
  user,
  viewingUser,
  setViewingUser,
  setChatMessages,
  socket,
  setChats,
  setActiveChat,
}) {
  const [newMessage, setNewMessage] = useState("");

  const [friendStatus, setFriendStatus] = useState("none");

  const [currentRequestId, setCurrentRequestId] = useState(null);

  const messagesEndRef = useRef(null);

  const messagesContainerRef = useRef(null);

  const viewingUserRef = useRef(viewingUser);

  // ==========================================================
  // KEEP LATEST VIEWING USER
  // ==========================================================

  useEffect(() => {
    viewingUserRef.current = viewingUser;
  }, [viewingUser]);

  // ==========================================================
  // SCROLL
  // ==========================================================

  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({
      behavior,
    });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [chatMessages]);

  // ==========================================================
  // OTHER USER
  // ==========================================================

  const otherUser =
    !activeChat?.is_group && activeChat?.members
      ? activeChat.members.find(
          (member) => Number(member.id) !== Number(user.id),
        )
      : null;

  // ==========================================================
  // FRIENDSHIP STATUS
  // ==========================================================

  useEffect(() => {
    if (!viewingUser) {
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/friends/status/${viewingUser.id}`);

        setFriendStatus(res.data.status);

        setCurrentRequestId(res.data.requestId ?? null);
      } catch (err) {
        console.error("Failed to fetch friend status:", err);
      }
    };

    fetchStatus();
  }, [viewingUser]);

  // ==========================================================
  // FRIEND REQUEST SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (!socket?.current) {
      return;
    }

    const handleSent = (req) => {
      const vu = viewingUserRef.current;

      if (!vu) {
        return;
      }

      if (
        Number(req.receiver?.id) === Number(user.id) &&
        Number(vu.id) === Number(req.sender?.id)
      ) {
        setFriendStatus("pending");

        setCurrentRequestId(req.id);
      }

      if (
        Number(req.sender?.id) === Number(user.id) &&
        Number(vu.id) === Number(req.receiver?.id)
      ) {
        setFriendStatus("sent");

        setCurrentRequestId(req.id);
      }
    };

    const handleAccepted = (req) => {
      const vu = viewingUserRef.current;

      if (
        (Number(req.sender?.id) === Number(user.id) &&
          Number(vu?.id) === Number(req.receiver?.id)) ||
        (Number(req.receiver?.id) === Number(user.id) &&
          Number(vu?.id) === Number(req.sender?.id))
      ) {
        setFriendStatus("friends");

        setCurrentRequestId(null);
      }
    };

    const handleRejected = (req) => {
      const vu = viewingUserRef.current;

      if (
        (Number(req.sender?.id) === Number(user.id) &&
          Number(vu?.id) === Number(req.receiver?.id)) ||
        (Number(req.receiver?.id) === Number(user.id) &&
          Number(vu?.id) === Number(req.sender?.id))
      ) {
        setFriendStatus("none");

        setCurrentRequestId(null);
      }
    };

    socket.current.on("friendRequestSent", handleSent);

    socket.current.on("friendRequestAccepted", handleAccepted);

    socket.current.on("friendRequestRejected", handleRejected);

    return () => {
      socket.current?.off("friendRequestSent", handleSent);

      socket.current?.off("friendRequestAccepted", handleAccepted);

      socket.current?.off("friendRequestRejected", handleRejected);
    };
  }, [socket, user.id]);

  // ==========================================================
  // RECEIVE NEW MESSAGE
  //
  // ONLY updates messages inside the currently open chat.
  //
  // useSocket handles chat-list state.
  // ==========================================================

  useEffect(() => {
    if (!socket?.current || !activeChat?.id || activeChat.isTemporary) {
      return;
    }

    const handleNewMessage = (message) => {
      const messageChatId = message.chat_id ?? message.chatId;

      if (String(messageChatId) !== String(activeChat.id)) {
        return;
      }

      // Ignore our own message.
      if (Number(message.sender_id ?? message.senderId) === Number(user.id)) {
        return;
      }

      setChatMessages((prev) => {
        const alreadyExists = prev.some(
          (existingMessage) =>
            Number(existingMessage.id) === Number(message.id),
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, message];
      });

      scrollToBottom("smooth");
    };

    socket.current.on("newMessage", handleNewMessage);

    return () => {
      socket.current?.off("newMessage", handleNewMessage);
    };
  }, [
    socket,
    activeChat?.id,
    activeChat?.isTemporary,
    user.id,
    setChatMessages,
  ]);

  // ==========================================================
  // MARK MESSAGES AS READ
  // ==========================================================

  useEffect(() => {
    if (
      !activeChat?.id ||
      activeChat.isTemporary ||
      !user?.id ||
      !Array.isArray(chatMessages) ||
      chatMessages.length === 0
    ) {
      return;
    }

    const unreadMessageIds = chatMessages
      .filter((message) => {
        const isIncoming =
          Number(message.sender_id ?? message.senderId) !== Number(user.id);

        const isUnread = message.is_read !== true;

        const hasValidId =
          Number.isInteger(Number(message.id)) && Number(message.id) > 0;

        return isIncoming && isUnread && hasValidId;
      })
      .map((message) => Number(message.id));

    if (unreadMessageIds.length === 0) {
      return;
    }

    console.log("Marking messages as read:", unreadMessageIds);

    let cancelled = false;

    const markAsRead = async () => {
      try {
        const response = await api.post(`/chats/${activeChat.id}/read`, {
          messageIds: unreadMessageIds,
        });

        if (cancelled) {
          return;
        }

        const markedMessageIds = new Set(
          (response.data.messageIds || []).map(Number),
        );

        if (markedMessageIds.size === 0) {
          return;
        }

        // ================================================
        // UPDATE MESSAGE READ STATE
        // ================================================

        setChatMessages((prev) =>
          prev.map((message) =>
            markedMessageIds.has(Number(message.id))
              ? {
                  ...message,
                  is_read: true,
                }
              : message,
          ),
        );

        // ================================================
        // CLEAR CHAT BADGE
        // ================================================

        setChats((prevChats) =>
          prevChats.map((chat) =>
            String(chat.id) === String(activeChat.id)
              ? {
                  ...chat,
                  unread_count: 0,
                }
              : chat,
          ),
        );
      } catch (err) {
        console.error(
          "Failed to mark messages as read:",
          err.response?.data || err,
        );
      }
    };

    markAsRead();

    return () => {
      cancelled = true;
    };
  }, [
    activeChat?.id,
    activeChat?.isTemporary,
    chatMessages,
    user?.id,
    setChatMessages,
    setChats,
  ]);

  // ==========================================================
  // RECEIVE messagesRead
  // ==========================================================

  useEffect(() => {
    if (!socket?.current || !activeChat?.id) {
      return;
    }

    const handleMessagesRead = (data) => {
      if (String(data.chatId) !== String(activeChat.id)) {
        return;
      }

      const readMessageIds = new Set((data.messageIds || []).map(Number));

      if (readMessageIds.size === 0) {
        return;
      }

      setChatMessages((prev) =>
        prev.map((message) =>
          readMessageIds.has(Number(message.id))
            ? {
                ...message,
                is_read: true,
              }
            : message,
        ),
      );
    };

    socket.current.on("messagesRead", handleMessagesRead);

    return () => {
      socket.current?.off("messagesRead", handleMessagesRead);
    };
  }, [socket, activeChat?.id, setChatMessages]);

  // ==========================================================
  // JOIN ACTIVE CHAT ROOM
  // ==========================================================

  useEffect(() => {
    if (!socket?.current || !activeChat?.id || activeChat.isTemporary) {
      return;
    }

    const chatId = String(activeChat.id);

    console.log("Joining chat room:", chatId);

    socket.current.emit("joinRoom", chatId);

    return () => {
      console.log("Leaving chat room:", chatId);

      socket.current?.emit("leaveRoom", chatId);
    };
  }, [socket, activeChat?.id, activeChat?.isTemporary]);

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const handleSendMessage = async () => {
    const content = newMessage.trim();

    if (!content) {
      return;
    }

    if (!activeChat?.id) {
      console.error("Cannot send message: no active chat");

      return;
    }

    try {
      const res = await api.post(`/chats/${activeChat.id}/messages`, {
        content,

        friendId: activeChat.friendId,
      });

      const realChatId = res.data.chatId;

      const savedMessage = res.data.message;

      if (!savedMessage) {
        console.error("Backend did not return saved message:", res.data);

        return;
      }

      setNewMessage("");

      // ====================================================
      // ADD SENT MESSAGE LOCALLY
      // ====================================================

      setChatMessages((prev) => {
        const alreadyExists = prev.some(
          (msg) => Number(msg.id) === Number(savedMessage.id),
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, savedMessage];
      });

      // ====================================================
      // TEMPORARY CHAT -> REAL CHAT
      // ====================================================

      if (String(activeChat.id) !== String(realChatId)) {
        const updatedChat = {
          ...activeChat,

          id: realChatId,

          isTemporary: false,

          lastMessage: savedMessage.content,

          unread_count: 0,
        };

        setChats((prevChats) =>
          prevChats.map((chat) =>
            String(chat.id) === String(activeChat.id) ? updatedChat : chat,
          ),
        );

        setActiveChat(updatedChat);

        socket?.current?.emit("joinRoom", realChatId);

        socket?.current?.emit("leaveRoom", activeChat.id);
      } else {
        // ================================================
        // EXISTING CHAT
        // ================================================

        setChats((prevChats) =>
          prevChats.map((chat) =>
            String(chat.id) === String(realChatId)
              ? {
                  ...chat,

                  lastMessage: savedMessage.content,

                  isTemporary: false,
                }
              : chat,
          ),
        );
      }

      scrollToBottom("smooth");

      // ====================================================
      // NOTIFY SOCKET SERVER
      // ====================================================

      socket?.current?.emit("sendMessage", {
        ...savedMessage,

        chat_id: realChatId,
      });
    } catch (err) {
      console.error("Send message error:", err.response?.data || err);
    }
  };

  // ==========================================================
  // INFINITE SCROLL
  // ==========================================================

  const handleScroll = async (e) => {
    if (
      e.target.scrollTop !== 0 ||
      !chatMessages.length ||
      activeChat?.isTemporary
    ) {
      return;
    }

    const oldestMessageId = chatMessages[0].id;

    try {
      const res = await api.get(
        `/chats/${activeChat.id}/messages?before=${oldestMessageId}`,
      );

      if (res.data.length === 0) {
        return;
      }

      const container = messagesContainerRef.current;

      if (!container) {
        return;
      }

      const scrollHeightBefore = container.scrollHeight;

      setChatMessages((prev) => {
        const existingIds = new Set(prev.map((message) => Number(message.id)));

        const newMessages = res.data.filter(
          (message) => !existingIds.has(Number(message.id)),
        );

        return [...newMessages, ...prev];
      });

      setTimeout(() => {
        const scrollHeightAfter = container.scrollHeight;

        container.scrollTop = scrollHeightAfter - scrollHeightBefore;
      }, 0);
    } catch (err) {
      console.error("Failed to load older messages:", err);
    }
  };

  // ==========================================================
  // FRIEND REQUEST
  // ==========================================================

  const sendFriendRequest = async () => {
    try {
      const res = await api.post("/friends/request", {
        receiver_id: viewingUser.id,
      });

      setFriendStatus("sent");

      setCurrentRequestId(res.data.request.id);

      alert("Friend request sent!");
    } catch (err) {
      console.error("Friend request error:", err);

      alert("Failed to send request");
    }
  };

  // ==========================================================
  // ACCEPT FRIEND REQUEST
  // ==========================================================

  const handleAccept = async () => {
    try {
      await acceptFriendRequest(currentRequestId);

      setFriendStatus("friends");

      setCurrentRequestId(null);
    } catch (err) {
      console.error("Accept request error:", err);
    }
  };

  // ==========================================================
  // REJECT FRIEND REQUEST
  // ==========================================================

  const handleReject = async () => {
    try {
      await rejectFriendRequest(currentRequestId);

      setFriendStatus("none");

      setCurrentRequestId(null);
    } catch (err) {
      console.error("Reject request error:", err);
    }
  };

  // ==========================================================
  // PROFILE
  // ==========================================================

  if (viewingUser) {
    return (
      <main className={styles.profile}>
        <img
          src={viewingUser.avatar || "/defaultUserProfile.png"}
          alt={viewingUser.username}
          className={styles.profileAvatar}
        />

        <h2>{viewingUser.username}</h2>

        <div className={styles.profileDetails}>
          {viewingUser.full_name && <p>Full Name: {viewingUser.full_name}</p>}

          <p>Email: {viewingUser.email}</p>

          {viewingUser.bio && <p>Bio: {viewingUser.bio}</p>}
        </div>

        <div className={styles.profileActions}>
          {friendStatus === "none" && (
            <button onClick={sendFriendRequest}>Add Friend</button>
          )}

          {friendStatus === "sent" && <button disabled>Request Sent</button>}

          {friendStatus === "pending" && (
            <>
              <button onClick={handleAccept}>Accept</button>

              <button onClick={handleReject}>Reject</button>
            </>
          )}

          {friendStatus === "friends" && <button disabled>Friends</button>}

          <button onClick={() => setViewingUser(null)}>Back</button>
        </div>
      </main>
    );
  }

  // ==========================================================
  // NO ACTIVE CHAT
  // ==========================================================

  if (!activeChat) {
    return (
      <main className={styles.chatWindow}>
        <div className={styles.emptyChat}>Select a chat to start messaging</div>
      </main>
    );
  }

  // ==========================================================
  // ACTIVE CHAT
  // ==========================================================

  return (
    <main className={styles.chatWindow}>
      {/* ====================================================
          HEADER
         ==================================================== */}

      <div className={styles.chatHeader}>
        <h3>
          {activeChat.is_group
            ? activeChat.name
            : otherUser?.username || "Chat"}
        </h3>

        <span>last seen just now</span>
      </div>

      {/* ====================================================
          MESSAGES
         ==================================================== */}

      <div
        className={styles.messages}
        onScroll={handleScroll}
        ref={messagesContainerRef}>
        {chatMessages.map((msg) => {
          const isSentByCurrentUser =
            Number(msg.sender_id ?? msg.senderId) === Number(user.id);

          return (
            <div
              key={msg.id}
              className={`${styles.message} ${
                isSentByCurrentUser ? styles.sent : styles.received
              }`}>
              <span>{msg.content}</span>

              {isSentByCurrentUser && (
                <span className={styles.readStatus}>
                  {msg.is_read ? "✓✓" : "✓"}
                </span>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ====================================================
          INPUT
         ==================================================== */}

      <div className={styles.messageInput}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();

              handleSendMessage();
            }
          }}
        />

        <button onClick={handleSendMessage}>Send</button>
      </div>
    </main>
  );
}
