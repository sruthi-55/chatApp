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
  // resizer
  const SIDEBAR_WIDTH = 70;
  const {
    width: chatListWidth,
    startResizing,
    stopResizing,
    resize,
  } = useResizer(280, 250, SIDEBAR_WIDTH);

  // user + chats
  const user = useUser();
  const [chats, setChats] = useChats(user);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedSection, setSelectedSection] = useState("allChats");

  const [chatWindowVisible, setChatWindowVisible] = useState(true);

  // local ref to store setFriends function from ChatsListSection
  const setFriendsRef = useRef(null);

  // socket (now passes setFriendsRef to keep friends list updated)
  const socket = useSocket(
    user,
    activeChat,
    setChats,
    setChatMessages,
    null, // no setFriendStatus here
    setFriendsRef.current, // pass ref.current (the function from ChatsListSection)
  );

  const [currentSection, setCurrentSection] = useState("allChats");
  const [viewingUser, setViewingUser] = useState(null);

  //# get messages of active chat
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

    // cleanup: leave room when switching
    return () => {
      socket.current?.emit("leaveRoom", activeChat.id);
    };
  }, [activeChat, socket]);

  if (!user) return <p>Loading...</p>;

  const friendsChats = chats.filter((chat) => chat.type === "friend");
  const isChatSection = ["allChats", "friendsChat"].includes(selectedSection);

  const handleViewUserProfile = (user) => {
    setViewingUser(user);
    setActiveChat(null);
  };

  return (
    <div
      className={styles.container}
      onMouseMove={resize}
      onMouseUp={stopResizing}>
      <Sidebar
        user={user}
        style={{ width: `${SIDEBAR_WIDTH}px` }}
        setSelectedSection={setSelectedSection}
        setChatWindowVisible={setChatWindowVisible}
      />

      {isChatSection ? (
        <>
          <aside
            className={styles.chatList}
            style={{ width: `${chatListWidth}px` }}>
            <ChatsListSection
              chats={selectedSection === "allChats" ? chats : friendsChats}
              activeChat={activeChat}
              setActiveChat={(chat) => {
                setActiveChat(chat);
                setViewingUser(null);
              }}
              onSearchUserClick={handleViewUserProfile}
              setChats={setChats}
              socket={socket} // pass full ref, not socket.current
              isFriendsSection={selectedSection === "friendsChat"}
              registerSetFriends={(fn) => {
                setFriendsRef.current = fn; // pass setFriends back up for socket to use
              }}
              setChatWindowVisible={setChatWindowVisible}
            />
          </aside>

          <div className={styles.resizer} onMouseDown={startResizing} />

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
        <main className={styles.fullWidthSection}>
          {selectedSection === "profile" && (
            <div>
              <Profile />
            </div>
          )}
          {selectedSection === "requests" && <RequestsSection />}
          {selectedSection === "rooms" && <div>Rooms list here</div>}
        </main>
      )}
    </div>
  );
}
