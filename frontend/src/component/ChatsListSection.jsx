import { useState, useEffect } from "react";
import { searchUser } from "../api/user";
import styles from "./ChatListSection.module.css";
import { getFriends, startChat } from "../api/friends";

export default function ChatsListSection({
  chats,
  activeChat,
  setActiveChat,
  isFriendsSection,
  onSearchUserClick,
  setChats,
  socket,
  registerSetFriends, // 🔥 NEW PROP: parent passes down to register setFriends
}) {
  const [friends, setFriends] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false); // overlay toggle

  // 🔥 expose setFriends to parent (so useSocket can refresh friends on events)
  useEffect(() => {
    if (registerSetFriends) {
      registerSetFriends(setFriends);
    }
  }, [registerSetFriends]);

  // Fetch friends on component mount or when switching to friends section
  useEffect(() => {
    if (isFriendsSection) {
      getFriends("/friends")
        .then((data) => setFriends(data))
        .catch((err) => console.error("Error fetching friends:", err));
    }
  }, [isFriendsSection]);

  // live search whenever searchTerm changes
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
        const users = Array.isArray(data) ? data : data.users || [];
        setResults(users);
        setError(users.length === 0 ? "No users found" : null);
        setShowOverlay(true);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
        setError("No users found");
        setShowOverlay(true);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn); // cleanup previous timer
  }, [searchTerm]);

  const handleResultClick = (user) => {
    setShowOverlay(false);
    setResults([]);
    setSearchTerm("");
    onSearchUserClick(user);
  };

  // start chat
  const handleStartChatClick = async (friend) => {
    try {
      const newChat = await startChat(friend.id);
      setActiveChat(newChat);
      setChats((prev) => [newChat, ...prev]);

      // ✅ safer: only emit if socket is alive
      if (socket) {
        socket.emit("joinChat", newChat.id); // join WebSocket room
      }
    } catch (err) {
      console.error("Start chat failed:", err);
    }
  };

  return (
    <div className={styles.chatListSection}>
      {isFriendsSection && (
        <div>
          <div className={styles.searchContainer}>
            <input
              className={styles.serachUserInput}
              type="text"
              placeholder="search by username or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => results.length > 0 && setShowOverlay(true)}
            />

            {/* search res dropdown overlay */}
            {showOverlay && (
              <div className={styles.searchOverlay} role="listbox">
                {error && <p className={styles.error}>{error}</p>}
                {results.map((user) => (
                  <div
                    key={user.id}
                    className={styles.searchResult}
                    onClick={() => handleResultClick(user)}
                    role="option"
                    tabIndex={0}>
                    <div className={styles.resultMain}>
                      <p className={styles.resultName}>{user.username}</p>
                      <small className={styles.resultId}>ID: {user.id}</small>
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

          {/* friends chats here */}
          {friends.map((friend) => {
            const existingChat = chats.find((c) =>
              c.members?.includes(friend.id)
            );
            const hasMessages =
              existingChat?.lastMessage || existingChat?.messages?.length > 0;

            return (
              <div key={friend.id} className={styles.chatItem}>
                <div className={styles.chatInfo}>
                  <p className={styles.chatName}>{friend.username}</p>
                  <p className={styles.chatLastMssg}>{friend.email}</p>
                </div>

                {/* 🔥 Show Start Chat button only if chat has no messages yet */}
                {!hasMessages && (
                  <button
                    className={styles.startChatBtn}
                    onClick={() => handleStartChatClick(friend)}>
                    Start Chat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
