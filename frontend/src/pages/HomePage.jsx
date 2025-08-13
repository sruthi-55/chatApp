import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import styles from "./Homepage.module.css";
import FriendsIcon from "../assets/icons/FriendsIcon.svg";
import ChatIcon from "../assets/icons/Chat.svg";
import InvitationIcon from "../assets/icons/invitation.svg";
import RoomIcon from "../assets/icons/room.svg";
import LogoutIcon from "../assets/icons/logout.svg";
import SettingsIcon from "../assets/icons/settings.svg";
import SearchIcon from "../assets/icons/search.svg";
import MoreIcon from "../assets/icons/more.svg";

export default function Homepage() {
  const [sidebarWidth, setSidebarWidth] = useState(70); // px
  const [chatListWidth, setChatListWidth] = useState(280); // px
  const isResizingSidebar = useRef(false);
  const isResizingChatList = useRef(false);

  const startResizingSidebar = () => {
    isResizingSidebar.current = true;
  };

  const startResizingChatList = () => {
    isResizingChatList.current = true;
  };

  const stopResizing = () => {
    isResizingSidebar.current = false;
    isResizingChatList.current = false;
  };

  const resize = (e) => {
    if (isResizingSidebar.current) {
      setSidebarWidth(Math.max(50, e.clientX)); // min 50px
    } else if (isResizingChatList.current) {
      setChatListWidth(Math.max(200, e.clientX - sidebarWidth)); // min 200px
    }
  };

  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    api
      .get("/api/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => navigate("/login"));
  }, [navigate]);

  if (!user) return <p>Loading...</p>;

  const chats = [
    { id: 1, name: "John Doe", lastMessage: "Hey there!" },
    { id: 2, name: "Jane Smith", lastMessage: "How's it going?" },
    { id: 3, name: "Alex Brown", lastMessage: "Let's meet tomorrow." },
  ];

  return (
    <div
      className={styles.container}
      onMouseMove={resize}
      onMouseUp={stopResizing}
    >
      {/* 1st col: Sidebar */}
      <aside
        className={styles.sidebar}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className={styles.profileIcons}>
          <img
            src={user.avatar || "/defaultUserProfile.png"}
            alt="Avatar"
            className={styles.avatar}
          />
          <img src={ChatIcon} alt="Chat Icon" className={styles.icon}/>
          <img src={InvitationIcon} alt="Invitation Icon" className={styles.icon}/>
          <img src={RoomIcon} alt="Room Icon" className={styles.icon}/>
        </div>

        <div className={styles.bottomIcons}>
          <img src={SettingsIcon} alt="Settings Icon" className={styles.icon}/>
          <img src={LogoutIcon} alt="Logout Icon" className={styles.icon}/>
        </div>
      </aside>

      {/* 2nd col: Chat List */}
      <aside
        className={styles.chatList}
        style={{ width: `${chatListWidth}px` }}
      >
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`${styles.chatItem} ${
              activeChat?.id === chat.id ? styles.activeChat : ""
            }`}
            onClick={() => setActiveChat(chat)}
          >
            <div className={styles.chatInfo}>
              <p classname={styles.chatName}>{chat.name}</p>
              <p className={styles.chatLastMssg}>{chat.lastMessage}</p>
            </div>
          </div>
        ))}
      </aside>

      {/* Resizer */}
      <div
        className={styles.resizer}
        onMouseDown={startResizingChatList}
      />

      {/* 3rd col: Chat Window */}
      <main className={styles.chatWindow}>
        {activeChat ? (
          <>
            <div className={styles.chatHeader}>
              <div>
                <div className={styles.chatName}>{activeChat.name}</div>
                <div className={styles.lastSeen}> last seen just now</div>
              </div>
              

              <div className={styles.headerIcons}>
                <img src={SearchIcon} alt="Search Icon" className={styles.icon}/>
                <img src={MoreIcon} alt="More Icon" className={styles.icon}/>
              </div>
            </div>
            
            <div className={styles.messages}>
              <div className={`${styles.message} ${styles.received}`}>Hello!</div>
              <div className={`${styles.message} ${styles.sent}`}>
                Hi there!
              </div>
            </div>
            <div className={styles.messageInput}>
              <input type="text" placeholder="Type a message..." />
              <button>Send</button>
            </div>
          </>
        ) : (
          <div className={styles.noChatSelected}>
            Select a chat to start messaging
          </div>
        )}
      </main>
    </div>
  );
}
