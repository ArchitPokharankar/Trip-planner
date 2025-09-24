// MyTrips.js
import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  query,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function MyTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);

  // Edit modal state
  const [editingTrip, setEditingTrip] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDestination, setEditedDestination] = useState("");
  const [editedDays, setEditedDays] = useState("");

  const navigate = useNavigate();

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        setTrips([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch user's trips
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const tripsCollection = collection(db, "users", user.uid, "trips");
    const q = query(tripsCollection);

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const tripsData = [];
        querySnapshot.forEach((doc) => {
          tripsData.push({ id: doc.id, ...doc.data() });
        });
        setTrips(tripsData);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to fetch trips.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleToggleExpand = (tripId) => {
    setExpandedTripId(expandedTripId === tripId ? null : tripId);
  };

  const handleDeleteTrip = async (tripId) => {
    try {
      const tripDocRef = doc(db, "users", user.uid, "trips", tripId);
      await deleteDoc(tripDocRef);
    } catch (err) {
      console.error("Error deleting trip: ", err);
      setError("Could not delete the trip.");
    }
  };

  const handleEditTrip = (trip) => {
    setEditingTrip(trip);
    setEditedTitle(trip.title || "");
    setEditedDestination(trip.destination || "");
    setEditedDays(trip.days || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTrip) return;
    try {
      const tripDocRef = doc(db, "users", user.uid, "trips", editingTrip.id);
      await updateDoc(tripDocRef, {
        title: editedTitle,
        destination: editedDestination,
        days: editedDays,
      });
      setEditingTrip(null);
    } catch (err) {
      console.error("Error updating trip:", err);
      setError("Could not update the trip.");
    }
  };

  return (
    <div style={styles.page}>
      {/* Back button */}
      <button style={styles.backBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={styles.header}>
        <h1 style={{ margin: 0 }}>My Trips</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Browse, review, and manage your saved travel itineraries.
        </p>
      </div>

      <div style={styles.content}>
        {loading && <p>Loading your trips...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && !user && <p>Please log in to see your saved trips.</p>}
        {!loading && user && trips.length === 0 && (
          <p>You haven't saved any trips yet. Go plan one!</p>
        )}

        {user && trips.length > 0 && (
          <div style={styles.tripList}>
            {trips.map((trip) => (
              <div key={trip.id} style={styles.tripItem}>
                <div
                  style={styles.tripHeader}
                  onClick={() => handleToggleExpand(trip.id)}
                >
                  <span style={styles.tripTitle}>{trip.title}</span>
                  <span>{expandedTripId === trip.id ? "▲" : "▼"}</span>
                </div>

                {expandedTripId === trip.id && (
                  <div style={styles.tripDetails}>
                    {/* Optional image preview */}
                    {trip.imageUrl && (
                      <img
                        src={trip.imageUrl}
                        alt="Trip"
                        style={styles.tripImage}
                      />
                    )}

                    <p>
                      <strong>Destination:</strong> {trip.destination}
                    </p>
                    <p>
                      <strong>Days:</strong> {trip.days}
                    </p>
                    {trip.budget && (
                      <p>
                        <strong>Budget:</strong> {trip.budget}
                      </p>
                    )}
                    {trip.travelers && (
                      <p>
                        <strong>Travelers:</strong> {trip.travelers}
                      </p>
                    )}

                    <h4 style={styles.itineraryTitle}>Itinerary</h4>
                    {trip.itinerary?.map((dayPlan, idx) => (
                      <div key={idx} style={styles.dayCard}>
                        <h5 style={styles.dayTitle}>
                          Day {dayPlan.day}: {dayPlan.title}
                        </h5>
                        <strong>Activities:</strong>
                        <ul style={styles.list}>
                          {dayPlan.activities?.map((activity, actIdx) => (
                            <li key={actIdx}>{activity}</li>
                          ))}
                        </ul>
                        <strong>Food Suggestions:</strong>
                        <p style={styles.foodText}>
                          {dayPlan.food_suggestions}
                        </p>
                      </div>
                    ))}

                    <div style={styles.buttonGroup}>
                      <button
                        style={{ ...styles.button, ...styles.editButton }}
                        onClick={() => handleEditTrip(trip)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.deleteButton }}
                        onClick={() => handleDeleteTrip(trip.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingTrip && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Edit Trip</h2>
            <label>
              Title:
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
              />
            </label>
            <label>
              Destination:
              <input
                type="text"
                value={editedDestination}
                onChange={(e) => setEditedDestination(e.target.value)}
              />
            </label>
            <label>
              Days:
              <input
                type="number"
                value={editedDays}
                onChange={(e) => setEditedDays(e.target.value)}
              />
            </label>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.button, ...styles.editButton }}
                onClick={handleSaveEdit}
              >
                💾 Save
              </button>
              <button
                style={{ ...styles.button, ...styles.deleteButton }}
                onClick={() => setEditingTrip(null)}
              >
                ✖ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "sans-serif",
    background: "#f9fafb",
  },
  backBtn: {
    margin: "10px",
    padding: "6px 12px",
    border: "none",
    borderRadius: "6px",
    background: "#e5e7eb",
    cursor: "pointer",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
  },
  tripList: {
    maxWidth: "800px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  tripItem: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  tripHeader: {
    padding: "16px 20px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f3f4f6",
    borderRadius: "10px 10px 0 0",
  },
  tripTitle: {
    fontWeight: "bold",
    fontSize: "18px",
  },
  tripDetails: {
    padding: "0 20px 20px 20px",
    borderTop: "1px solid #e5e7eb",
  },
  tripImage: {
    width: "100%",
    borderRadius: "8px",
    marginBottom: "15px",
    maxHeight: "200px",
    objectFit: "cover",
  },
  itineraryTitle: {
    marginTop: "20px",
    marginBottom: "10px",
  },
  dayCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    background: "#fafafa",
    marginBottom: 12,
  },
  dayTitle: { margin: "0 0 12px 0", color: "#1f2937" },
  list: { paddingLeft: 20, margin: "8px 0" },
  foodText: { margin: "8px 0 0 0", fontStyle: "italic", color: "#4b5563" },
  buttonGroup: {
    marginTop: "20px",
    display: "flex",
    gap: "10px",
  },
  button: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },
  editButton: {
    background: "#3b82f6",
  },
  deleteButton: {
    background: "#ef4444",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    width: "400px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
};
