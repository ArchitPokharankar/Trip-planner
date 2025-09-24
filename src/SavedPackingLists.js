// SavedPackingLists.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "./firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";

export default function SavedPackingLists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔥 Fetch lists when component mounts
  useEffect(() => {
    const fetchLists = async () => {
      const user = auth.currentUser;
      if (!user) {
        alert("⚠️ Please login to view saved lists.");
        navigate("/");
        return;
      }

      try {
        const q = query(
          collection(db, "users", user.uid, "packingLists"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLists(data);
      } catch (err) {
        console.error(err);
        alert("❌ Failed to fetch saved lists.");
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [navigate]);

  // 🗑 Delete a list
  const handleDelete = async (id) => {
    const user = auth.currentUser;
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this list?")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "packingLists", id));
      setLists((prev) => prev.filter((list) => list.id !== id));
    } catch (err) {
      console.error(err);
      alert("❌ Failed to delete list.");
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📂 Saved Packing Lists</h1>

      <button
        style={styles.backButton}
        onClick={() => navigate("/pack-my-bag")}
      >
        ⬅ Back to Pack My Bag
      </button>

      {loading && <p>Loading your saved lists...</p>}

      {!loading && lists.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          No saved packing lists yet. Go create one!
        </p>
      )}

      <div style={styles.listContainer}>
        {lists.map((list) => (
          <div key={list.id} style={styles.card}>
            <h2 style={styles.cardTitle}>{list.destination}</h2>
            <p>
              <strong>Duration:</strong> {list.duration} days
            </p>
            <p>
              <strong>Activities:</strong> {list.activities}
            </p>
            <p>
              <strong>Season:</strong> {list.season}
            </p>

            <div style={styles.cardActions}>
              <button
                style={styles.viewButton}
                onClick={() =>
                  alert(
                    (list.categories || [])
                      .map(
                        (cat) =>
                          `${cat.category}:\n- ${cat.items
                            .map((i) => i.text)
                            .join("\n- ")}`
                      )
                      .join("\n\n")
                  )
                }
              >
                👀 View List
              </button>
              <button
                style={styles.deleteButton}
                onClick={() => handleDelete(list.id)}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Styles ---
const styles = {
  page: {
    padding: "24px",
    fontFamily: "sans-serif",
    background: "#f9fafb",
    minHeight: "100vh",
  },
  title: {
    fontSize: "28px",
    marginBottom: "16px",
  },
  backButton: {
    padding: "10px 16px",
    marginBottom: "20px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  listContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
    color: "#111827",
  },
  cardActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "12px",
  },
  viewButton: {
    background: "#3b82f6",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  deleteButton: {
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
};
