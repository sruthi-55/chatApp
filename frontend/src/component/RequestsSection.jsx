import { useEffect, useState } from "react";
import api from "../api/axios";
import styles from "./RequestsSection.module.css";

export default function RequestsSection() {
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const res = await api.get("/friends/requests/pending"); // only pending
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch friend requests:", err);
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.post(`/friends/requests/${id}/accept`);
      loadRequests();
    } catch (err) {
      console.error("Accept failed:", err);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/friends/requests/${id}/reject`);
      loadRequests();
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
                    onClick={() => handleAccept(req.id)}>
                    Accept
                  </button>
                  <button
                    className={`${styles.btn} ${styles.reject}`}
                    onClick={() => handleReject(req.id)}>
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
