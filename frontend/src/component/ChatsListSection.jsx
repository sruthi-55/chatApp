import { useState, useEffect } from "react";

import { searchUser } from "../api/user";
import { getFriends } from "../api/friends";

import styles from "./ChatListSection.module.css";

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

    let friend = null;

    if (!chat.is_group && Array.isArray(chat.members)) {
      friend = chat.members.find(
        (member) => Number(member.id) !== Number(currentUserId),
      );

      if (!friendId) {
        friendId = friend?.id || null;
      }
    }

    let chatName = chat.name;

    if (!chatName && !chat.is_group) {
      chatName = friend?.username || "Chat";
    }

    return {
      ...chat,

      lastMessage: lastMessageText,

      friendId,

      name: chatName,

      unread_count: Number(chat.unread_count ?? 0),
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
  // SELECT CHAT
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
  // ============================================================

  const createTemporaryChat = (selectedUser) => {
    const temporaryId = `temp-${selectedUser.id}-${Date.now()}`;

    const temporaryChat = {
      id: temporaryId,

      members: [
        {
          id: Number(currentUserId),
          username: "You",
        },
        {
          id: Number(selectedUser.id),
          username: selectedUser.username,
          avatar: selectedUser.avatar,
          email: selectedUser.email,
        },
      ],

      friendId: Number(selectedUser.id),

      name: `Chat with ${selectedUser.username}`,

      lastMessage: "",

      is_group: false,

      type: "friend",

      isTemporary: true,

      unread_count: 0,
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

        if (isFriendsSection) {
          const friendIds = new Set(friends.map((friend) => Number(friend.id)));

          users = users.filter((searchedUser) =>
            friendIds.has(Number(searchedUser.id)),
          );
        }

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
  // FRIEND CHATS
  // ============================================================

  const friendChats = friends
    .map((friend) =>
      chatsWithFriendId.find(
        (chat) => Number(chat.friendId) === Number(friend.id),
      ),
    )
    .filter(Boolean);

  // ============================================================
  // RENDER CHAT ITEM
  // ============================================================

  const renderChatItem = (chat) => {
    const unreadCount = Number(chat.unread_count ?? 0);

    const displayName =
      chat.name ||
      chat.members?.find(
        (member) => Number(member.id) !== Number(currentUserId),
      )?.username ||
      "Chat";

    const isActive = activeChat && String(activeChat.id) === String(chat.id);

    return (
      <div
        key={chat.id}
        className={`${styles.chatItem} ${isActive ? styles.activeChat : ""}`}
        onClick={() => handleChatSelection(chat)}>
        <div className={styles.chatInfo}>
          <div className={styles.chatNameRow}>
            <p className={styles.chatName}>{displayName}</p>

            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount}</span>
            )}
          </div>

          <p className={styles.chatLastMssg}>{chat.lastMessage || ""}</p>
        </div>
      </div>
    );
  };

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
          CHAT LIST
         ====================================================== */}

      {isFriendsSection ? (
        <div>{friendChats.map(renderChatItem)}</div>
      ) : (
        <div>{chatsWithFriendId.map(renderChatItem)}</div>
      )}
    </div>
  );
}
