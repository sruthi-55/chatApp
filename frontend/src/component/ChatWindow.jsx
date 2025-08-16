import { useState } from "react";
import styles from "./ChatWindow.module.css";
import SearchIcon from "../assets/icons/search.svg";
import MoreIcon from "../assets/icons/more.svg";
import api from "../api/axios";

export default function ChatWindow({ activeChat, chatMessages, user, viewingUser, setViewingUser, setChatMessages }) {
  const [newMessage, setNewMessage] = useState("");   // local input state
  const [friendRequestSent, setFriendRequestSent] = useState(false); // disable after send

  // send message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return; // don’t send empty msg

    try {
      const res = await api.post(`/chats/${activeChat.id}/messages`, {
        content: newMessage,
      });

      setChatMessages((prev) => [...prev, res.data]);
      setNewMessage(""); // clear input
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // if viewing a user profile
  if (viewingUser) {
    return (
      <main className={styles.chatWindow}>
        <div className={styles.searchResSection}>
          {/* User Avatar and Name */}
          <div className={styles.profileHeader}>
            <img
              src={viewingUser.avatar || "/defaultUserProfile.png"}
              alt={viewingUser.username}
              className={styles.profileAvatar}
            />
            <h2>{viewingUser.username}</h2>
          </div>

          {/* User details */}
          <div className={styles.profileDetails}>
            {viewingUser.full_name && <p>Full Name: {viewingUser.full_name}</p>}
            <p>Email: {viewingUser.email}</p>
            {viewingUser.bio && <p>Bio: {viewingUser.bio}</p>}
          </div>

          {/* Action buttons */}
          <div className={styles.profileActions}>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  await api.post(
                    `/friends/request`,
                    { receiver_id: viewingUser.id }, // correct field
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  setFriendRequestSent(true); // disable button
                  alert("Friend request sent!");
                } catch (err) {
                  console.error("Friend request error:", err);
                  alert("Failed to send request");
                }
              }}
              disabled={friendRequestSent} // disable after send
            >
              {friendRequestSent ? "Request Sent" : "Add Friend"}
            </button>

            <button onClick={() => setViewingUser(null)}>Back</button>
          </div>
        </div>
      </main>
    );
  }

  // if no active chat
  if (!activeChat) {
    return <div className={styles.noChatSelected}>Select a chat to start messaging</div>;
  }

  // if in a chat
  return (
    <main className={styles.chatWindow}>
      {/* Chat header */}
      <div className={styles.chatHeader}>
        <div>
          <div className={styles.chatName}>{activeChat.name}</div>
          <div className={styles.lastSeen}>last seen just now</div>
        </div>
        <div className={styles.headerIcons}>
          <img src={SearchIcon} alt="Search" className={styles.icon} />
          <img src={MoreIcon} alt="More" className={styles.icon} />
        </div>
      </div>

      {/* Chat messages */}
      <div className={styles.messages}>
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.sender_id === user.id ? styles.sent : styles.received}`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className={styles.messageInput}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </main>
  );
}
