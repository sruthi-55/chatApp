import api from "./axios";

// Get all friends for logged-in user
export const getFriends = async () => {
  const res = await api.get("/friends");
  return res.data;
};



// Start chat with a friend
export const startChat = async (friendId) => {
  const res = await api.post("/chats/start", { friendId });
  return res.data;
};

// Get all requests (incoming + outgoing)
export const fetchFriendRequests = async () => {
  const res = await api.get("/friends/requests");
  return res.data;
};

// Get pending friend requests (incoming + outgoing)
export const fetchPendingFriendRequests = async () => {
  try {
    const res = await api.get("/friends/requests/pending");
    return res.data;
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    throw err;
  }
};


// Accept request
export const acceptFriendRequest = async (requestId) => {
  const res = await api.post(`/friends/requests/${requestId}/accept`);
  return res.data;
};

// Reject request
export const rejectFriendRequest = async (requestId) => {
  const res = await api.post(`/friends/requests/${requestId}/reject`);
  return res.data;
};
