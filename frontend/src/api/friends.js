import api from "./axios";

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
