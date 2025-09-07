import { useState, useEffect } from "react";
import { searchUser } from "../api/user";
import styles from "./ChatListSection.module.css";
import { getFriends, startChat } from "../api/friends";

export default function ChatsListSection({
  chats,
  activeChat,
  setActiveChat,
  isFriendsSection,
  onSearchUserClick,
  setChats,
  socket,
  registerSetFriends,
  currentUserId, // current logged-in user id
}) {
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);

  // expose setFriends to parent
  useEffect(() => {
    if (registerSetFriends) {
      registerSetFriends(setFriends);
    }
  }, [registerSetFriends]);

  // fetch friends
  useEffect(() => {
    if (isFriendsSection) {
      getFriends("/friends")
        .then((data) => setFriends(data))
        .catch((err) => console.error("Error fetching friends:", err));
    }
  }, [isFriendsSection]);

  // search users with debounce
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
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleResultClick = (user) => {
    setShowOverlay(false);
    setResults([]);
    setSearchTerm("");
    onSearchUserClick(user);
  };

  // start chat
  const handleStartChatClick = async (friend) => {
    try {
      const newChat = await startChat(friend.id);

      // attach friendId from friend object
      const chatWithFriendId = { ...newChat, friendId: friend.id, lastMessage: "" };

      setActiveChat(chatWithFriendId);

      // add new chat to state
      setChats((prev) => [chatWithFriendId, ...prev]);

      if (socket?.current) {
        socket.current.emit("joinRoom", chatWithFriendId.id);
      }
    } catch (err) {
      console.error("Start chat failed:", err);
    }
  };

  // immediately update lastMessage when sender sends a message
  const handleMessageSend = (chatId, content) => {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? { ...chat, lastMessage: content }
          : chat
      )
    );
  };

  // listen for new messages (sent or received) to update chats
  useEffect(() => {
    if (!socket?.current) return;

    const handleNewMessage = (message) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === message.chatId
            ? { ...chat, lastMessage: message.content }
            : chat
        )
      );
    };

    socket.current.on("newMessage", handleNewMessage);
    socket.current.on("messageSent", handleNewMessage); // update sender side immediately

    return () => {
      socket.current.off("newMessage", handleNewMessage);
      socket.current.off("messageSent", handleNewMessage);
    };
  }, [socket]);

  // map chats to include friendId and normalize lastMessage
  const chatsWithFriendId = chats.map((chat) => {
    let lastMessageText = "";
    if (chat.lastMessage) {
      lastMessageText = typeof chat.lastMessage === "string"
        ? chat.lastMessage
        : chat.lastMessage.content || "";
    }

    let friendId = chat.friendId;
    if (!friendId && chat.members && !chat.is_group) {
      const friend = chat.members.find((m) => m.id !== Number(currentUserId));
      friendId = friend?.id || null;
    }

    let chatName = chat.name;
    if (!chatName && !chat.is_group && chat.members) {
      const friend = chat.members.find((m) => m.id !== Number(currentUserId));
      chatName = friend?.username ? `Chat with ${friend.username}` : "Chat";
    }

    return {
      ...chat,
      lastMessage: lastMessageText,
      friendId,
      name: chatName,
    };
  });

  return (
    <div className={styles.chatListSection}>
      {isFriendsSection && (
        <div>
          <div className={styles.searchContainer}>
            <input
              className={styles.serachUserInput}
              type="text"
              placeholder="search by username or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => results.length > 0 && setShowOverlay(true)}
            />
            {showOverlay && (
              <div className={styles.searchOverlay} role="listbox">
                {error && <p className={styles.error}>{error}</p>}
                {results.map((user) => (
                  <div
                    key={user.id}
                    className={styles.searchResult}
                    onClick={() => handleResultClick(user)}
                    role="option"
                    tabIndex={0}>
                    <div className={styles.resultMain}>
                      <p className={styles.resultName}>{user.username}</p>
                      <small className={styles.resultId}>ID: {user.id}</small>
                    </div>
                  </div>
                ))}
                {(error || results.length > 0) && (
                  <button
                    className={styles.closeOverlayBtn}
                    onClick={() => setShowOverlay(false)}>
                    Close
                  </button>
                )}
              </div>
            )}
          </div>

          {friends.map((friend) => {
            const chat = chatsWithFriendId.find((c) => c.friendId === friend.id);

            const hasMessages = !!chat?.lastMessage;

            const handleClick = () => {
              if (chat) {
                setActiveChat(chat);
              } else {
                handleStartChatClick(friend);
              }
            };

            return (
              <div key={friend.id} className={styles.chatItem} onClick={handleClick}>
                <div className={styles.chatInfo}>
                  <p className={styles.chatName}>{friend.username}</p>
                  <p className={styles.chatLastMssg}>{chat?.lastMessage || ""}</p>
                </div>

                {!hasMessages && (
                  <button
                    className={styles.startChatBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartChatClick(friend);
                    }}>
                    Start Chat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
