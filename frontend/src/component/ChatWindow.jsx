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

  // ============================================================
  // KEEP LATEST VIEWING USER
  // ============================================================

  useEffect(() => {
    viewingUserRef.current = viewingUser;
  }, [viewingUser]);

  // ============================================================
  // SCROLL HELPER
  // ============================================================

  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({
      behavior,
    });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [chatMessages]);

  // ============================================================
  // DETERMINE OTHER USER
  // ============================================================

  const otherUser =
    !activeChat?.is_group && activeChat?.members
      ? activeChat.members.find(
          (member) => Number(member.id) !== Number(user.id),
        )
      : null;

  // ============================================================
  // FETCH FRIENDSHIP STATUS
  // ============================================================

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

  // ============================================================
  // FRIEND REQUEST SOCKET EVENTS
  // ============================================================

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

  // ============================================================
  // RECEIVE MESSAGES
  //
  // THIS IS THE ONLY PLACE WHERE RECEIVED SOCKET MESSAGES
  // ARE ADDED TO chatMessages.
  // ============================================================

  useEffect(() => {
    if (!socket?.current || !activeChat?.id || activeChat.isTemporary) {
      return;
    }

    const handleNewMessage = (message) => {
      const messageChatId = message.chat_id ?? message.chatId;

      if (String(messageChatId) !== String(activeChat.id)) {
        return;
      }

      /*
       * The sender already adds their own message from
       * the HTTP response.
       *
       * Therefore don't add the same message again when
       * Socket.IO sends it back.
       */

      if (Number(message.sender_id) === Number(user.id)) {
        return;
      }

      setChatMessages((prev) => {
        /*
         * Extra protection against duplicate socket events.
         *
         * If message ID already exists, don't add it again.
         */

        const alreadyExists = prev.some(
          (msg) => Number(msg.id) === Number(message.id),
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

  // ============================================================
  // MARK MESSAGES AS READ
  //
  // The current user is the READER.
  //
  // We only send IDs of messages:
  //
  //   1. belonging to the current chat
  //   2. sent by another user
  //   3. currently marked as unread
  //
  // Backend then inserts:
  //
  //   message_id + current_user_id
  //
  // into message_reads.
  // ============================================================

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
        const isIncoming = Number(message.sender_id) !== Number(user.id);

        const isUnread = message.is_read !== true;

        const hasValidId =
          Number.isInteger(Number(message.id)) && Number(message.id) > 0;

        return isIncoming && isUnread && hasValidId;
      })
      .map((message) => Number(message.id));

    if (unreadMessageIds.length === 0) {
      return;
    }

    console.log("Sending messages to mark as read:", {
      chatId: activeChat.id,
      userId: user.id,
      messageIds: unreadMessageIds,
    });

    let cancelled = false;

    const markAsRead = async () => {
      try {
        const response = await api.post(`/chats/${activeChat.id}/read`, {
          messageIds: unreadMessageIds,
        });

        console.log("Mark as read response:", response.data);

        if (cancelled) {
          return;
        }

        const markedMessageIds = new Set(
          (response.data.messageIds || []).map(Number),
        );

        if (markedMessageIds.size === 0) {
          return;
        }

        // Immediately update local receiver state.
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
  ]);

  // ============================================================
  // RECEIVE MESSAGE READ EVENTS
  //
  // Receiver has read one or more messages that WE sent.
  //
  // Backend sends:
  //
  // {
  //   chatId: 5,
  //   messageIds: [31, 32],
  //   readBy: 7
  // }
  //
  // We update our sent messages:
  //
  //     ✓  →  ✓✓
  // ============================================================

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

  // ============================================================
  // JOIN ACTIVE CHAT SOCKET ROOM
  // ============================================================
  //
  // This makes sure the current user receives realtime
  // messages for the chat they opened.
  //
  // It is separate from the HTTP read-receipt mechanism.
  // ============================================================

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

  // ============================================================
  // SEND MESSAGE
  // ============================================================

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

      // ========================================================
      // ADD SENT MESSAGE LOCALLY
      //
      // This is the ONLY place where the sender adds
      // their own message.
      // ========================================================

      setChatMessages((prev) => {
        const alreadyExists = prev.some(
          (msg) => Number(msg.id) === Number(savedMessage.id),
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, savedMessage];
      });

      // ========================================================
      // TEMPORARY CHAT -> REAL CHAT
      // ========================================================

      if (String(activeChat.id) !== String(realChatId)) {
        const updatedChat = {
          ...activeChat,

          id: realChatId,

          isTemporary: false,

          lastMessage: savedMessage.content,
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
        // ======================================================
        // EXISTING CHAT
        // ======================================================

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

      // ========================================================
      // NOTIFY SOCKET SERVER
      // ========================================================

      socket?.current?.emit("sendMessage", {
        ...savedMessage,
        chat_id: realChatId,
      });
    } catch (err) {
      console.error("Send message error:", err.response?.data || err);
    }
  };

  // ============================================================
  // INFINITE SCROLL
  // ============================================================

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

      /*
       * Backend already returns messages in
       * chronological order.
       *
       * Do NOT reverse here.
       */

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

  // ============================================================
  // SEND FRIEND REQUEST
  // ============================================================

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

  // ============================================================
  // ACCEPT FRIEND REQUEST
  // ============================================================

  const handleAccept = async () => {
    try {
      await acceptFriendRequest(currentRequestId);

      setFriendStatus("friends");

      setCurrentRequestId(null);
    } catch (err) {
      console.error("Accept request error:", err);
    }
  };

  // ============================================================
  // REJECT FRIEND REQUEST
  // ============================================================

  const handleReject = async () => {
    try {
      await rejectFriendRequest(currentRequestId);

      setFriendStatus("none");

      setCurrentRequestId(null);
    } catch (err) {
      console.error("Reject request error:", err);
    }
  };

  // ============================================================
  // USER PROFILE
  // ============================================================

  if (viewingUser) {
    return (
      <main className={styles.chatWindow}>
        <div className={styles.profileContainer}>
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
        </div>
      </main>
    );
  }

  // ============================================================
  // NO ACTIVE CHAT
  // ============================================================

  if (!activeChat) {
    return (
      <main className={styles.chatWindow}>
        <div className={styles.noChatSelected}>
          Select a chat to start messaging
        </div>
      </main>
    );
  }

  // ============================================================
  // ACTIVE CHAT
  // ============================================================

  return (
    <main className={styles.chatWindow}>
      {/* ======================================================
          CHAT HEADER
         ====================================================== */}

      <div className={styles.chatHeader}>
        <h3>
          {activeChat.is_group
            ? activeChat.name
            : otherUser?.username || "Chat"}
        </h3>

        <span>last seen just now</span>
      </div>

      {/* ======================================================
          MESSAGES
         ====================================================== */}

      <div
        className={styles.messages}
        onScroll={handleScroll}
        ref={messagesContainerRef}>
        {chatMessages.map((msg) => {
          const isSentByCurrentUser = Number(msg.sender_id) === Number(user.id);

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

      {/* ======================================================
          INPUT
         ====================================================== */}

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
