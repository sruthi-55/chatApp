import { useState } from "react";
import api from "../api/axios";
import styles from "./ChatListSection.module.css";

export default function ChatsListSection({ chats, activeChat, setActiveChat, isFriendsSection, onSearchUserClick,}) {
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  const searchUser = async () => {
    if (!searchId.trim()) return;
    try {
      const res = await api.get(`/api/user/${searchId}`);
      setSearchResult(res.data);
    } catch {
      setSearchResult(null);
      alert("User not found");
    }
  };

  return (
    <div>
      {/* display search by user id only in friends section */}
      {isFriendsSection && (
        <div className={styles.searchContainer}>
          <input className={styles.serachUserInput}
            type="text"
            placeholder="User ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button className={styles.searchUserBtn} onClick={searchUser}>Search</button>
          {searchResult && (
            <div
              className={styles.searchResult}
              onClick={() => onSearchUserClick(searchResult)}
            >
              <p>{searchResult.name}</p>
              <small>ID: {searchResult.id}</small>
            </div>
          )}
        </div>
      )}

      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`${styles.chatItem} ${
            activeChat?.id === chat.id ? styles.activeChat : ""
          }`}
          onClick={() => setActiveChat(chat)}
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
