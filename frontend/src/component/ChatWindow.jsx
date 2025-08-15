import styles from "./ChatWindow.module.css";
import SearchIcon from "../assets/icons/search.svg";
import MoreIcon from "../assets/icons/more.svg";
import api from "../api/axios";

export default function ChatWindow({ activeChat, viewingUser, setViewingUser }) {
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
            {/* not working as of now */}
            <button
              onClick={async () => {
                try {
                  await api.post(`/api/friends/request`, {
                    toUserId: viewingUser.id,
                  });
                  alert("Friend request sent!");
                } catch {
                  alert("Failed to send request");
                }
              }}
            >
              Add Friend
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
        <div className={`${styles.message} ${styles.received}`}>Hello!</div>
        <div className={`${styles.message} ${styles.sent}`}>Hi there!</div>
      </div>

      {/* Message input */}
      <div className={styles.messageInput}>
        <input type="text" placeholder="Type a message..." />
        <button>Send</button>
      </div>
    </main>
  );
}
