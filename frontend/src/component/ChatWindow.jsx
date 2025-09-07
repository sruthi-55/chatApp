import { useState, useEffect, useRef } from "react";
import styles from "./ChatWindow.module.css";
import SearchIcon from "../assets/icons/search.svg";
import MoreIcon from "../assets/icons/more.svg";
import api from "../api/axios";
import { acceptFriendRequest, rejectFriendRequest } from "../api/friends";

export default function ChatWindow({
  activeChat,
  chatMessages,
  user,
  viewingUser,
  setViewingUser,
  setChatMessages,
  socket,
}) {
  const [newMessage, setNewMessage] = useState("");
  const [friendStatus, setFriendStatus] = useState("none");
  const [currentRequestId, setCurrentRequestId] = useState(null); // store request id for accept/reject
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const viewingUserRef = useRef(viewingUser); // keep latest viewingUser

  // update ref when viewingUser changes
  useEffect(() => {
    viewingUserRef.current = viewingUser;
  }, [viewingUser]);

  // scroll to bottom helper
  const scrollToBottom = (behavior = "auto") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom("auto");
  }, [chatMessages]);

  //# determine other user for 1-on-1 chat
  const otherUser =
    !activeChat?.is_group && activeChat?.members
      ? activeChat.members.find((m) => m.id !== user.id)
      : null;

  // fetch relationship status when viewing a user
  useEffect(() => {
    if (!viewingUser) return;

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/friends/status/${viewingUser.id}`);
        setFriendStatus(res.data.status);

        // If status is pending, we might need requestId for accept/reject
        if (res.data.requestId) {
          setCurrentRequestId(res.data.requestId);
        }
      } catch (err) {
        console.error("Failed to fetch friend status:", err);
      }
    };

    fetchStatus();
  }, [viewingUser]);

  // subscribe to socket updates for friend status
  useEffect(() => {
    if (!socket?.current) return;

    const handleSent = (req) => {
      const vu = viewingUserRef.current;
      if (!vu) return;

      // If I’m the receiver, status should be pending
      if (req.receiver.id === user.id && vu.id === req.sender.id) {
        setFriendStatus("pending");
        setCurrentRequestId(req.id);
      }
      // If I’m the sender, status is "sent"
      if (req.sender.id === user.id && vu.id === req.receiver.id) {
        setFriendStatus("sent");
        setCurrentRequestId(req.id);
      }
    };

    const handleAccepted = (req) => {
      const vu = viewingUserRef.current;
      if (
        (req.sender.id === user.id && vu?.id === req.receiver.id) ||
        (req.receiver.id === user.id && vu?.id === req.sender.id)
      ) {
        setFriendStatus("friends");
        setCurrentRequestId(null);
      }
    };

    const handleRejected = (req) => {
      const vu = viewingUserRef.current;
      if (
        (req.sender.id === user.id && vu?.id === req.receiver.id) ||
        (req.receiver.id === user.id && vu?.id === req.sender.id)
      ) {
        setFriendStatus("none");
        setCurrentRequestId(null);
      }
    };

    socket.current.on("friendRequestSent", handleSent);
    socket.current.on("friendRequestAccepted", handleAccepted);
    socket.current.on("friendRequestRejected", handleRejected);

    return () => {
      socket.current.off("friendRequestSent", handleSent);
      socket.current.off("friendRequestAccepted", handleAccepted);
      socket.current.off("friendRequestRejected", handleRejected);
    };
  }, [socket, user]);

  // handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const res = await api.post(`/chats/${activeChat.id}/messages`, {
        content: newMessage,
      });

      setChatMessages((prev) => [...prev, res.data]);
      setNewMessage("");
      scrollToBottom("smooth");

      // send via socket
      socket?.current?.emit("sendMessage", {
        ...res.data,
        chat_id: activeChat.id,
      });
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // handle infinite scroll for older messages
  const handleScroll = async (e) => {
    if (e.target.scrollTop === 0 && chatMessages.length) {
      const token = localStorage.getItem("token");
      const oldestMessageId = chatMessages[0].id;

      try {
        const res = await api.get(
          `/chats/${activeChat.id}/messages?before=${oldestMessageId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.data.length > 0) {
          const container = messagesContainerRef.current;
          const scrollHeightBefore = container.scrollHeight;

          setChatMessages((prev) => [...res.data.reverse(), ...prev]);

          setTimeout(() => {
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
          }, 0);
        }
      } catch (err) {
        console.error("Failed to load older messages:", err);
      }
    }
  };

  // send friend request
  const sendFriendRequest = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        `/friends/request`,
        { receiver_id: viewingUser.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFriendStatus("sent");
      setCurrentRequestId(res.data.request.id);
      alert("Friend request sent!");
    } catch (err) {
      console.error("Friend request error:", err);
      alert("Failed to send request");
    }
  };

  // accept friend request
  const handleAccept = async () => {
    try {
      await acceptFriendRequest(currentRequestId);
      setFriendStatus("friends");
      setCurrentRequestId(null);
    } catch (err) {
      console.error("Accept request error:", err);
    }
  };

  // reject friend request
  const handleReject = async () => {
    try {
      await rejectFriendRequest(currentRequestId);
      setFriendStatus("none");
      setCurrentRequestId(null);
    } catch (err) {
      console.error("Reject request error:", err);
    }
  };

  // view user profile
  if (viewingUser) {
    return (
      <main className={styles.chatWindow}>
        <div className={styles.searchResSection}>
          <div className={styles.profileHeader}>
            <img
              src={viewingUser.avatar || "/defaultUserProfile.png"}
              alt={viewingUser.username}
              className={styles.profileAvatar}
            />
            <h2>{viewingUser.username}</h2>
          </div>

          <div className={styles.profileDetails}>
            {viewingUser.full_name && <p>Full Name: {viewingUser.full_name}</p>}
            <p>Email: {viewingUser.email}</p>
            {viewingUser.bio && <p>Bio: {viewingUser.bio}</p>}
          </div>

          <div className={styles.profileActions}>
            {friendStatus === "none" && (
              <button onClick={sendFriendRequest}>Add Friend</button>
            )}
            {friendStatus === "sent" && <button disabled>Request Sent</button>}
            {friendStatus === "pending" && (
              <>
                <button onClick={handleAccept}>Accept</button>
                <button onClick={handleReject}>Reject</button>
              </>
            )}
            {friendStatus === "friends" && <button disabled>Friends</button>}
            <button onClick={() => setViewingUser(null)}>Back</button>
          </div>
        </div>
      </main>
    );
  }

  // no active chat
  if (!activeChat)
    return (
      <div className={styles.noChatSelected}>
        Select a chat to start messaging
      </div>
    );

  // active chat
  return (
    <main className={styles.chatWindow}>
      {/* chat header */}
      <div className={styles.chatHeader}>
        <div>
          <div className={styles.chatName}>
            {activeChat.is_group
              ? activeChat.name
              : otherUser?.username || "Chat"}
          </div>
          <div className={styles.lastSeen}>last seen just now</div>
        </div>
        <div className={styles.headerIcons}>
          <img src={SearchIcon} alt="Search" className={styles.icon} />
          <img src={MoreIcon} alt="More" className={styles.icon} />
        </div>
      </div>

      {/* chat messages */}
      <div
        className={styles.messages}
        onScroll={handleScroll}
        ref={messagesContainerRef}>
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${
              msg.sender_id === user.id ? styles.sent : styles.received
            }`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* input */}
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
