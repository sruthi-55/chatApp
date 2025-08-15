import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import styles from "./Homepage.module.css";
import ChatsListSection from "../component/ChatsListSection";
import ChatWindow from "../component/ChatWindow";
import Sidebar from "../component/Sidebar";

export default function Homepage() {
  const [sidebarWidth] = useState(70); // px
  const [chatListWidth, setChatListWidth] = useState(280); // px
  const isResizingChatList = useRef(false);

  // resizing
  const startResizingChatList = () => {
    isResizingChatList.current = true;
  };
  const stopResizing = () => {
    isResizingChatList.current = false;
  };
  const resize = (e) => {
    if (isResizingChatList.current) {
      setChatListWidth(Math.max(250, e.clientX - sidebarWidth));
    }
  };

  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [chats, setChats] = useState([]); // all chats fetched from DB
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]); // messages of active chat
  const [selectedSection, setSelectedSection] = useState("allChats");
  const [viewingUser, setViewingUser] = useState(null); // for profile view in chat window

  // get token and set cur user
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    api
      .get("/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        console.log("Current user from /user/me:", res.data); // 🔍 debug
        setUser(res.data);
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  // fetch chats for logged-in user
  useEffect(() => {
    if (!user) return;
    api
      .get("/chats")
      .then((res) => {
        const chatsData = res.data.map((chat) => {
          let chatName = chat.is_group
            ? chat.name
            : `Chat with ${chat.memberids.find((id) => id !== user.id)}`;

          return {
            id: chat.id,
            name: chatName,
            lastMessage: chat.last_message_content || "",
            type: chat.is_group ? "group" : "friend",
          };
        });
        setChats(chatsData);
      })
      .catch((err) => console.error("Failed to fetch chats:", err));
  }, [user]);

  // fetch messages whenever activeChat changes
  useEffect(() => {
    if (!activeChat) return;
    const token = localStorage.getItem("token");

    api
      .get(`/chats/${activeChat.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setChatMessages(res.data))
      .catch((err) => console.error("Failed to fetch messages:", err));
  }, [activeChat]);

  if (!user) return <p>Loading...</p>;

  const allChats = chats;
  const friendsChats = chats.filter((chat) => chat.type === "friend");

  const isChatSection = ["allChats", "friendsChat"].includes(selectedSection);

  const handleSectionChange = (section) => {
    setSelectedSection(section);
    setViewingUser(null); // close profile when switching sections

    if (section === "allChats") return;

    // if switching to friendsChat and if user is not friend - remove active chat
    if (section === "friendsChat") {
      if (!friendsChats.some((chat) => chat.id === activeChat?.id)) {
        setActiveChat(null);
      }
      return;
    }

    setActiveChat(null);
  };

  const handleViewUserProfile = (user) => {
    setViewingUser(user);
    setActiveChat(null); // clear chat when profile is open
  };

  return (
    <div
      className={styles.container}
      onMouseMove={resize}
      onMouseUp={stopResizing}>
      <Sidebar
        user={user}
        setSelectedSection={handleSectionChange}
        style={{ width: "70px" }}
      />

      {isChatSection ? (
        <>
          <aside
            className={styles.chatList}
            style={{ width: `${chatListWidth}px` }}>
            <ChatsListSection
              chats={selectedSection === "allChats" ? allChats : friendsChats}
              activeChat={activeChat}
              setActiveChat={(chat) => {
                setActiveChat(chat);
                setViewingUser(null); // clear user profile when a chat is clicked
              }}
              isFriendsSection={selectedSection === "friendsChat"}
              onSearchUserClick={handleViewUserProfile}
            />
          </aside>
          <div className={styles.resizer} onMouseDown={startResizingChatList} />
          <ChatWindow
            activeChat={activeChat}
            chatMessages={chatMessages} // pass real messages
            setChatMessages={setChatMessages}
            user={user} // current user for sent/received
            viewingUser={viewingUser}
            setViewingUser={setViewingUser}
          />
        </>
      ) : (
        <main className={styles.fullWidthSection}>
          {selectedSection === "profile" && (
            <div className={styles.section}>Profile content here</div>
          )}
          {selectedSection === "requests" && (
            <div className={styles.section}>Requests list here</div>
          )}
          {selectedSection === "rooms" && (
            <div className={styles.section}>Rooms list here</div>
          )}
        </main>
      )}
    </div>
  );
}
