// Homepage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import styles from "./Homepage.module.css";
import ChatsListSection from "../component/ChatsListSection";
import ChatWindow from "../component/ChatWindow";
import Sidebar from "../component/Sidebar";
import RequestsSection from "../component/RequestsSection";
import { io } from "socket.io-client";

export default function Homepage() {
  const [sidebarWidth] = useState(70);
  const [chatListWidth, setChatListWidth] = useState(280);
  const isResizingChatList = useRef(false);

  const startResizingChatList = () => (isResizingChatList.current = true);
  const stopResizing = () => (isResizingChatList.current = false);
  const resize = (e) => {
    if (isResizingChatList.current)
      setChatListWidth(Math.max(250, e.clientX - sidebarWidth));
  };

  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedSection, setSelectedSection] = useState("allChats");
  const [viewingUser, setViewingUser] = useState(null);
  const socket = useRef(null);

  // fetch current user
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    api
      .get("/user/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setUser(res.data))
      .catch(() => navigate("/login"));
  }, [navigate]);

  // fetch chats
  useEffect(() => {
    if (!user) return;
    api
      .get("/chats")
      .then((res) => {
        const chatsData = res.data.map((chat) => ({
          id: chat.id,
          name: chat.is_group
            ? chat.name
            : `Chat with ${chat.memberids.find((id) => id !== user.id)}`,
          lastMessage: chat.last_message_content || "",
          type: chat.is_group ? "group" : "friend",
        }));
        setChats(chatsData);
      })
      .catch((err) => console.error("Failed to fetch chats:", err));
  }, [user]);

  // init socket connection
  useEffect(() => {
    if (!user) return;
    socket.current = io("http://localhost:5001", {
  withCredentials: true, // required if backend uses credentials
});

    socket.current.on("connect", () =>
      console.log("Socket connected:", socket.current.id)
    );

    // receive new message
    socket.current.on("newMessage", (message) => {
      if (message.chat_id === activeChat?.id) {
        setChatMessages((prev) => [...prev, message]);
      }
      // update lastMessage in chat list
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === message.chat_id
            ? { ...chat, lastMessage: message.content }
            : chat
        )
      );
    });

    return () => {
      socket.current.disconnect();
    };
  }, [user, activeChat]);

  // fetch messages for active chat
  useEffect(() => {
    if (!activeChat) return;

    const token = localStorage.getItem("token");

    api
      .get(`/chats/${activeChat.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setChatMessages(res.data))
      .catch((err) => console.error("Failed to fetch messages:", err));

    // join chat room for real-time messages
    socket.current?.emit("joinRoom", activeChat.id);
  }, [activeChat]);

  if (!user) return <p>Loading...</p>;

  const allChats = chats;
  const friendsChats = chats.filter((chat) => chat.type === "friend");
  const isChatSection = ["allChats", "friendsChat"].includes(selectedSection);

  const handleSectionChange = (section) => {
    setSelectedSection(section);
    setViewingUser(null);

    if (section === "friendsChat" && !friendsChats.some((chat) => chat.id === activeChat?.id)) {
      setActiveChat(null);
    } else if (!["allChats", "friendsChat"].includes(section)) {
      setActiveChat(null);
    }
  };

  const handleViewUserProfile = (user) => {
    setViewingUser(user);
    setActiveChat(null);
  };

  return (
    <div className={styles.container} onMouseMove={resize} onMouseUp={stopResizing}>
      <Sidebar user={user} setSelectedSection={handleSectionChange} style={{ width: "70px" }} />

      {isChatSection ? (
        <>
          <aside className={styles.chatList} style={{ width: `${chatListWidth}px` }}>
            <ChatsListSection
              chats={selectedSection === "allChats" ? allChats : friendsChats}
              activeChat={activeChat}
              setActiveChat={(chat) => {
                setActiveChat(chat);
                setViewingUser(null);
              }}
              isFriendsSection={selectedSection === "friendsChat"}
              onSearchUserClick={handleViewUserProfile}
            />
          </aside>
          <div className={styles.resizer} onMouseDown={startResizingChatList} />
          <ChatWindow
            activeChat={activeChat}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            user={user}
            viewingUser={viewingUser}
            setViewingUser={setViewingUser}
            socket={socket.current}
          />
        </>
      ) : (
        <main className={styles.fullWidthSection}>
          {selectedSection === "profile" && <div className={styles.section}>Profile content here</div>}
          {selectedSection === "requests" && (
            <div className={styles.section}>
              <RequestsSection />
            </div>
          )}
          {selectedSection === "rooms" && <div className={styles.section}>Rooms list here</div>}
        </main>
      )}
    </div>
  );
}
