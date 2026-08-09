import { useState, useEffect, useRef } from "react";

import api from "../api/axios";
import styles from "./Homepage.module.css";

import Sidebar from "../component/Sidebar";
import ChatsListSection from "../component/ChatsListSection";
import ChatWindow from "../component/ChatWindow";
import RequestsSection from "../component/RequestsSection";

import useUser from "../hooks/useUser";
import useChats from "../hooks/useChats";
import useSocket from "../hooks/useSocket";
import useResizer from "../hooks/useResizer";

import Profile from "./Profile";

export default function Homepage() {
  // ============================================================
  // RESIZER
  // ============================================================

  const SIDEBAR_WIDTH = 70;

  const { width: chatListWidth, startResizing } = useResizer(
    280,
    250,
    SIDEBAR_WIDTH,
  );

  // ============================================================
  // USER
  // ============================================================

  const user = useUser();

  // ============================================================
  // CHATS
  // ============================================================

  const [chats, setChats, refreshChats] = useChats(user);

  // ============================================================
  // LOCAL STATE
  // ============================================================

  const [activeChat, setActiveChat] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);

  const [selectedSection, setSelectedSection] = useState("allChats");

  const [chatWindowVisible, setChatWindowVisible] = useState(true);

  const [viewingUser, setViewingUser] = useState(null);

  // ============================================================
  // FRIENDS REF
  // ============================================================

  const setFriendsRef = useRef(null);

  // ============================================================
  // PREVIOUS SECTION
  //
  // Used to detect:
  //
  // allChats -> friendsChat
  // friendsChat -> allChats
  // profile -> friendsChat
  // etc.
  //
  // Whenever section changes, the currently open conversation
  // must be cleared.
  // ============================================================

  const previousSectionRef = useRef(selectedSection);

  // ============================================================
  // IS CHAT SECTION?
  // ============================================================

  const isChatSection = ["allChats", "friendsChat"].includes(selectedSection);

  // ============================================================
  // SOCKET
  // ============================================================

  const socket = useSocket(
    user,
    activeChat,
    setChats,
    null,
    setFriendsRef.current,
  );

  // ============================================================
  // CLEAR ACTIVE CHAT WHEN SECTION CHANGES
  //
  // THIS FIXES SCENARIO 1.
  //
  // Previously:
  //
  // allChats
  //   -> Chat 14 open
  //   -> friendsChat
  //
  // isChatSection stayed true.
  //
  // Therefore activeChat remained Chat 14.
  //
  // Socket then thought Chat 14 was still open.
  // ============================================================

  useEffect(() => {
    if (previousSectionRef.current !== selectedSection) {
      console.log(
        "Section changed:",
        previousSectionRef.current,
        "->",
        selectedSection,
      );

      setActiveChat(null);

      setChatMessages([]);

      setViewingUser(null);
    }

    previousSectionRef.current = selectedSection;
  }, [selectedSection]);

  // ============================================================
  // REFRESH CHAT LIST WHEN ENTERING CHAT SECTION
  // ============================================================

  useEffect(() => {
    if (!isChatSection || !user?.id) {
      return;
    }

    console.log("Chat section active -> refreshing chats");

    refreshChats();
  }, [isChatSection, user?.id, refreshChats]);

  // ============================================================
  // FETCH MESSAGES FOR ACTIVE CHAT
  // ============================================================

  useEffect(() => {
    if (!activeChat || activeChat.isTemporary) {
      setChatMessages([]);

      return;
    }

    const token = localStorage.getItem("token");

    api
      .get(`/chats/${activeChat.id}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setChatMessages(res.data);
      })
      .catch((err) => {
        console.error("Failed to fetch messages:", err);
      });
  }, [activeChat]);

  // ============================================================
  // VIEW USER PROFILE
  // ============================================================

  const handleViewUserProfile = (selectedUser) => {
    setViewingUser(selectedUser);

    setActiveChat(null);

    setChatMessages([]);

    setChatWindowVisible(true);
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (!user) {
    return <div>Loading...</div>;
  }

  // ============================================================
  // FRIEND CHATS
  // ============================================================

  const friendsChats = chats.filter((chat) => chat.type === "friend");

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className={styles.container}>
      {/* ======================================================
          SIDEBAR
         ====================================================== */}

      <Sidebar
        user={user}
        style={{
          width: `${SIDEBAR_WIDTH}px`,
        }}
        setSelectedSection={setSelectedSection}
        setChatWindowVisible={setChatWindowVisible}
      />

      {/* ======================================================
          CHAT SECTIONS
         ====================================================== */}

      {isChatSection ? (
        <>
          {/* ==================================================
              CHAT LIST
             ================================================== */}

          <aside
            className={styles.chatList}
            style={{
              width: `${chatListWidth}px`,
            }}>
            <ChatsListSection
              chats={selectedSection === "allChats" ? chats : friendsChats}
              activeChat={activeChat}
              setActiveChat={(chat) => {
                setActiveChat(chat);

                setViewingUser(null);
              }}
              onSearchUserClick={handleViewUserProfile}
              setChats={setChats}
              socket={socket}
              isFriendsSection={selectedSection === "friendsChat"}
              registerSetFriends={(fn) => {
                setFriendsRef.current = fn;
              }}
              setChatWindowVisible={setChatWindowVisible}
              currentUserId={user.id}
            />
          </aside>

          {/* ==================================================
              RESIZER
             ================================================== */}

          <div className={styles.resizer} onMouseDown={startResizing} />

          {/* ==================================================
              CHAT WINDOW
             ================================================== */}

          {chatWindowVisible && (
            <ChatWindow
              activeChat={activeChat}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              setChats={setChats}
              setActiveChat={setActiveChat}
              user={user}
              viewingUser={viewingUser}
              setViewingUser={setViewingUser}
              socket={socket}
            />
          )}
        </>
      ) : (
        // ====================================================
        // OTHER SECTIONS
        // ====================================================

        <main className={styles.fullWidthSection}>
          {selectedSection === "profile" && (
            <div className={styles.section}>
              <Profile />
            </div>
          )}

          {selectedSection === "requests" && (
            <div className={styles.section}>
              <RequestsSection />
            </div>
          )}

          {selectedSection === "rooms" && (
            <div className={styles.section}>Rooms list here</div>
          )}
        </main>
      )}
    </div>
  );
}
