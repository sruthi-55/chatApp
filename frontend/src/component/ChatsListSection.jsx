import { useState, useEffect } from "react";
import { searchUser } from "../api/user";
import styles from "./ChatListSection.module.css";

export default function ChatsListSection({
  chats,
  activeChat,
  setActiveChat,
  isFriendsSection,
  onSearchUserClick,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false); // overlay toggle

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
    }, 300); // 300ms 

    return () => clearTimeout(delayDebounceFn); // cleanup previous timer
  }, [searchTerm]);

  const handleResultClick = (user) => {
    setShowOverlay(false);
    setResults([]);
    setSearchTerm("");
    onSearchUserClick(user);
  };

  return (
    <div className={styles.chatListSection}>
      {isFriendsSection && (
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
                  tabIndex={0}
                >
                  <div className={styles.resultMain}>
                    <p className={styles.resultName}>{user.username}</p>
                    <small className={styles.resultId}>ID: {user.id}</small>
                  </div>
                </div>
              ))}
              {(error || results.length > 0) && (
                <button
                  className={styles.closeOverlayBtn}
                  onClick={() => setShowOverlay(false)}
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chats list */}
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`${styles.chatItem} ${
            activeChat?.id === chat.id ? styles.activeChat : ""
          }`}
          onClick={() => {
            setActiveChat(chat);
            setShowOverlay(false);  // hide overlay on chat click
          }}
        >
          <div className={styles.chatInfo}>
            <p className={styles.chatName}>{chat.name}</p>
            <p className={styles.chatLastMssg}>{chat.lastMessage}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
