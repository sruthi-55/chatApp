import { useEffect, useState } from "react";
import api from "../api/axios";
import styles from "./RequestsSection.module.css";
import useSocket from "../hooks/useSocket";
import useUser from "../hooks/useUser";

export default function RequestsSection() {
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });

  const user = useUser();
  const socket = useSocket(user); // get global socket

  useEffect(() => {
    loadRequests();
  }, []);

  //# fetch baseline from API
  const loadRequests = async () => {
    try {
      const res = await api.get("/friends/requests/pending"); // only pending
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch friend requests:", err);
    }
  };

  //# socket listeners for real-time updates
  useEffect(() => {
    if (!socket?.current) return;

    const handleNewRequest = (req) => {
      // if I'm the receiver -> add to incoming
      if (req.receiver.id === user.id) {
        setRequests((prev) => ({
          ...prev,
          incoming: [req, ...prev.incoming],
        }));
      }
      // if I'm the sender -> add to outgoing
      else if (req.sender.id === user.id) {
        setRequests((prev) => ({
          ...prev,
          outgoing: [req, ...prev.outgoing],
        }));
      }
    };

    const handleRequestAccepted = (req) => {
      // remove from incoming/outgoing since it’s no longer pending
      setRequests((prev) => ({
        incoming: prev.incoming.filter((r) => r.id !== req.id),
        outgoing: prev.outgoing.filter((r) => r.id !== req.id),
      }));
    };

    const handleRequestRejected = (req) => {
      // same as accept: remove from pending
      setRequests((prev) => ({
        incoming: prev.incoming.filter((r) => r.id !== req.id),
        outgoing: prev.outgoing.filter((r) => r.id !== req.id),
      }));
    };

    socket.current.on("friendRequestSent", handleNewRequest);
    socket.current.on("friendRequestAccepted", handleRequestAccepted);
    socket.current.on("friendRequestRejected", handleRequestRejected);

    return () => {
      if (socket?.current) {
        socket.current.off("friendRequestSent", handleNewRequest);
        socket.current.off("friendRequestAccepted", handleRequestAccepted);
        socket.current.off("friendRequestRejected", handleRequestRejected);
      }
    };
  }, [socket, user]);

  const handleAccept = async (id) => {
    try {
      await api.post(`/friends/requests/${id}/accept`);
      // socket will notify both users, so no manual reload needed
    } catch (err) {
      console.error("Accept failed:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/friends/requests/${id}/reject`);
      // socket will notify both users, so no manual reload needed
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  return (
    <div className={styles.requestsSectionWrapper}>
      <div className={styles.requestsSection}>
        <h3 className={styles.title}>Friend Requests</h3>

        {/* Incoming */}
        <h4 className={styles.subTitle}>Incoming</h4>
        {requests.incoming.length === 0 ? (
          <p className={styles.noRequests}>No incoming requests</p>
        ) : (
          <ul className={styles.list}>
            {requests.incoming.map((req) => (
              <li key={req.id} className={styles.requestItem}>
                <img
                  src={req.sender.avatar}
                  alt={req.sender.username}
                  className={styles.avatar}
                />
                <span className={styles.username}>{req.sender.username}</span>
                <div className={styles.buttons}>
                  <button
                    className={`${styles.btn} ${styles.accept}`}
                    onClick={() => handleAccept(req.id)}
                  >
                    Accept
                  </button>
                  <button
                    className={`${styles.btn} ${styles.reject}`}
                    onClick={() => handleReject(req.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Outgoing */}
        <h4 className={styles.subTitle}>Outgoing</h4>
        {requests.outgoing.length === 0 ? (
          <p className={styles.noRequests}>No outgoing requests</p>
        ) : (
          <ul className={styles.list}>
            {requests.outgoing.map((req) => (
              <li key={req.id} className={styles.requestItem}>
                <img
                  src={req.receiver.avatar}
                  alt={req.receiver.username}
                  className={styles.avatar}
                />
                <span className={styles.username}>{req.receiver.username}</span>
                <span className={styles.pending}>(pending)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
