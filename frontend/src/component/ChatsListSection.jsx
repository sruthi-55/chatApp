import { useState, useEffect } from "react";

import { searchUser } from "../api/user";

import styles from "./ChatListSection.module.css";

import { getFriends } from "../api/friends";

export default function ChatsListSection({
  chats,
  activeChat,
  setActiveChat,
  isFriendsSection,
  onSearchUserClick,
  setChats,
  socket,
  registerSetFriends,
  currentUserId,
  setChatWindowVisible,
}) {
  const [friends, setFriends] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [results, setResults] = useState([]);

  const [error, setError] = useState(null);

  const [showOverlay, setShowOverlay] = useState(false);

  // ============================================================
  // EXPOSE setFriends TO PARENT
  // ============================================================

  useEffect(() => {
    if (registerSetFriends) {
      registerSetFriends(setFriends);
    }
  }, [registerSetFriends]);

  // ============================================================
  // FETCH FRIENDS
  // ============================================================

  useEffect(() => {
    getFriends("/friends")
      .then((data) => {
        setFriends(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error fetching friends:", err);
      });
  }, []);

  // ============================================================
  // NORMALIZE CHATS
  // ============================================================

  const chatsWithFriendId = chats.map((chat) => {
    let lastMessageText = "";

    if (chat.lastMessage) {
      lastMessageText =
        typeof chat.lastMessage === "string"
          ? chat.lastMessage
          : chat.lastMessage.content || "";
    }

    let friendId = chat.friendId;

    if (!friendId && chat.members && !chat.is_group) {
      const friend = chat.members.find(
        (member) => Number(member.id) !== Number(currentUserId),
      );

      friendId = friend?.id || null;
    }

    let chatName = chat.name;

    if (!chatName && !chat.is_group && chat.members) {
      const friend = chat.members.find(
        (member) => Number(member.id) !== Number(currentUserId),
      );

      chatName = friend?.username ? `Chat with ${friend.username}` : "Chat";
    }

    return {
      ...chat,
      lastMessage: lastMessageText,
      friendId,
      name: chatName,
    };
  });

  // ============================================================
  // REMOVE TEMPORARY CHAT
  // ============================================================

  const removeTemporaryChat = (chat) => {
    if (!chat?.isTemporary) {
      return;
    }

    const hasMessages = chat.lastMessage && chat.lastMessage.trim().length > 0;

    if (hasMessages) {
      return;
    }

    setChats((prevChats) =>
      prevChats.filter(
        (existingChat) => String(existingChat.id) !== String(chat.id),
      ),
    );
  };

  // ============================================================
  // LEAVE CURRENT CHAT
  // ============================================================

  const leaveCurrentChat = () => {
    if (!activeChat) {
      return;
    }

    removeTemporaryChat(activeChat);

    if (socket?.current && activeChat.id) {
      socket.current.emit("leaveRoom", activeChat.id);
    }
  };

  // ============================================================
  // SELECT EXISTING CHAT
  // ============================================================

  const handleChatSelection = (chat) => {
    if (activeChat && String(activeChat.id) !== String(chat.id)) {
      leaveCurrentChat();
    }

    setActiveChat(chat);

    setChatWindowVisible(true);

    if (!chat.isTemporary && socket?.current && chat.id) {
      socket.current.emit("joinRoom", chat.id);
    }
  };

  // ============================================================
  // CREATE TEMPORARY CHAT
  //
  // NO DATABASE REQUEST HERE.
  // ============================================================

  const createTemporaryChat = (user) => {
    const temporaryId = `temp-${user.id}-${Date.now()}`;

    const temporaryChat = {
      id: temporaryId,

      members: [
        {
          id: Number(currentUserId),
          username: user.username,
        },
        {
          id: Number(user.id),
          username: user.username,
          avatar: user.avatar,
          email: user.email,
        },
      ],

      friendId: Number(user.id),

      name: `Chat with ${user.username}`,

      lastMessage: "",

      is_group: false,

      type: "friend",

      isTemporary: true,
    };

    setChats((prevChats) => [temporaryChat, ...prevChats]);

    setActiveChat(temporaryChat);

    setChatWindowVisible(true);

    return temporaryChat;
  };

  // ============================================================
  // SEARCH USERS
  // ============================================================

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setShowOverlay(false);
      setError(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await searchUser(searchTerm);

        let users = Array.isArray(data) ? data : data.users || [];

        // Friends section:
        // only show users who are friends.
        if (isFriendsSection) {
          const friendIds = new Set(friends.map((friend) => Number(friend.id)));

          users = users.filter((searchedUser) =>
            friendIds.has(Number(searchedUser.id)),
          );
        }

        // Never show current user.
        users = users.filter(
          (searchedUser) => Number(searchedUser.id) !== Number(currentUserId),
        );

        setResults(users);

        setError(users.length === 0 ? "No users found" : null);

        setShowOverlay(true);
      } catch (err) {
        console.error("Search error:", err);

        setResults([]);

        setError("No users found");

        setShowOverlay(true);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isFriendsSection, friends, currentUserId]);

  // ============================================================
  // HANDLE SEARCH RESULT
  // ============================================================

  const handleResultClick = (selectedUser) => {
    setShowOverlay(false);

    setResults([]);

    setSearchTerm("");

    const existingChat = chatsWithFriendId.find(
      (chat) => Number(chat.friendId) === Number(selectedUser.id),
    );

    if (existingChat) {
      handleChatSelection(existingChat);
      return;
    }

    createTemporaryChat(selectedUser);
  };

  // ============================================================
  // SOCKET MESSAGE EVENTS
  //
  // ONLY UPDATE CHAT LIST PREVIEW.
  //
  // Do NOT update chatMessages here.
  // ============================================================

  useEffect(() => {
    if (!socket?.current) {
      return;
    }

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

        // ======================================================
        // CHAT DOES NOT EXIST
        // ======================================================

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

        // ======================================================
        // CHAT EXISTS
        // ======================================================

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

    const handleMessageSent = (message) => {
      handleNewMessage(message);
    };

    socket.current.on("newMessage", handleNewMessage);

    socket.current.on("messageSent", handleMessageSent);

    return () => {
      socket.current?.off("newMessage", handleNewMessage);

      socket.current?.off("messageSent", handleMessageSent);
    };
  }, [socket, setChats]);

  // ============================================================
  // FRIEND CHATS
  //
  // Only show friends who actually have a chat.
  // ============================================================

  const friendChats = friends
    .map((friend) =>
      chatsWithFriendId.find(
        (chat) => Number(chat.friendId) === Number(friend.id),
      ),
    )
    .filter(Boolean);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className={styles.chatListSection}>
      {/* ======================================================
          SEARCH
         ====================================================== */}

      <div className={styles.searchContainer}>
        <input
          className={styles.serachUserInput}
          type="text"
          placeholder={
            isFriendsSection
              ? "Search friends by username or email"
              : "Search users by username or email"
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => results.length > 0 && setShowOverlay(true)}
        />

        {showOverlay && (
          <div className={styles.searchOverlay} role="listbox">
            {error && <p className={styles.error}>{error}</p>}

            {results.map((searchedUser) => (
              <div
                key={searchedUser.id}
                className={styles.searchResult}
                onClick={() => handleResultClick(searchedUser)}
                role="option"
                tabIndex={0}>
                <div className={styles.resultMain}>
                  <p className={styles.resultName}>{searchedUser.username}</p>

                  <small className={styles.resultId}>
                    ID: {searchedUser.id}
                  </small>
                </div>
              </div>
            ))}

            {(error || results.length > 0) && (
              <button
                className={styles.closeOverlayBtn}
                onClick={() => setShowOverlay(false)}>
                Close
              </button>
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          FRIEND CHAT LIST
         ====================================================== */}

      {isFriendsSection ? (
        <div>
          {friendChats.map((chat) => (
            <div
              key={chat.id}
              className={styles.chatItem}
              onClick={() => handleChatSelection(chat)}>
              <div className={styles.chatInfo}>
                <p className={styles.chatName}>
                  {chat.name ||
                    chat.members?.find(
                      (member) => Number(member.id) !== Number(currentUserId),
                    )?.username ||
                    "Chat"}
                </p>

                <p className={styles.chatLastMssg}>{chat.lastMessage || ""}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ====================================================
           ALL CHATS
           ==================================================== */

        <div>
          {chatsWithFriendId.map((chat) => (
            <div
              key={chat.id}
              className={styles.chatItem}
              onClick={() => handleChatSelection(chat)}>
              <div className={styles.chatInfo}>
                <p className={styles.chatName}>{chat.name || "Chat"}</p>

                <p className={styles.chatLastMssg}>{chat.lastMessage || ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
