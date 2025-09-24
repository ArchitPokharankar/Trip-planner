// src/SavedHotelsPage.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useNavigate } from "react-router-dom";

function SavedHotelsPage() {
  const [savedHotels, setSavedHotels] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedHotels = async () => {
      if (!auth.currentUser) return;
      const hotelsRef = collection(db, "users", auth.currentUser.uid, "savedHotels");
      const snapshot = await getDocs(hotelsRef);
      setSavedHotels(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    fetchSavedHotels();
  }, []);

  const removeHotel = async (hotelId) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "savedHotels", hotelId));
      setSavedHotels(savedHotels.filter((hotel) => hotel.id !== hotelId));
    } catch (error) {
      console.error("Error removing hotel:", error);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={() => navigate("/")}>← Back</button>
        <h2 style={{ margin: 0 }}>My Saved Hotels</h2>
      </div>

      {savedHotels.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: "20px" }}>No hotels saved yet.</p>
      ) : (
        <div style={styles.hotelGrid}>
          {savedHotels.map((hotel) => (
            <div key={hotel.id} style={styles.hotelCard}>
              <img
                src={hotel.photoUrl || "https://placehold.co/400x300/e5e7eb/6b7280?text=No+Image"}
                alt={hotel.name}
                style={styles.hotelImage}
              />
              <div style={styles.hotelInfo}>
                <h3 style={styles.hotelName}>{hotel.name}</h3>
                <p style={styles.hotelCity}>{hotel.city}</p>
                <p style={styles.hotelPrice}>{hotel.price ?? "Price not available"}</p>

                <div style={styles.actions}>
                  {hotel.checkoutUrl ? (
                    <a
                      href={hotel.checkoutUrl.startsWith("http") ? hotel.checkoutUrl : `https://www.booking.com${hotel.checkoutUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.viewDealButton}
                    >
                      View Deal
                    </a>
                  ) : (
                    <button style={{ ...styles.viewDealButton, opacity: 0.6 }} disabled>View Deal</button>
                  )}
                  <button style={styles.removeButton} onClick={() => removeHotel(hotel.id)}>
                    ❌ Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedHotelsPage;

// Styles
const styles = {
  page: { padding: "20px", fontFamily: "sans-serif", background: "#f9fafb", minHeight: "100vh" },
  header: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" },
  backButton: { background: "#000", color: "#fff", border: "none", padding: "8px 10px", borderRadius: "6px", fontSize: "14px", cursor: "pointer", fontWeight: "600" },
  hotelGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" },
  hotelCard: { border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", background: "white", boxShadow: "0 2px 6px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" },
  hotelImage: { width: "100%", height: "160px", objectFit: "cover", backgroundColor: "#f3f4f6" },
  hotelInfo: { padding: "12px", flex: 1, display: "flex", flexDirection: "column" },
  hotelName: { margin: "0 0 6px 0", fontSize: "16px" },
  hotelCity: { margin: "0 0 8px 0", fontSize: "14px", color: "#6b7280" },
  hotelPrice: { margin: 0, fontWeight: "700", fontSize: "16px", marginBottom: "12px" },
  actions: { marginTop: "auto", display: "flex", justifyContent: "space-between", gap: "10px" },
  viewDealButton: { backgroundColor: "#ff6b35", color: "white", padding: "8px 12px", borderRadius: "6px", textDecoration: "none", fontWeight: "700", fontSize: "14px", border: "none" },
  removeButton: { backgroundColor: "#ef4444", color: "white", padding: "8px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px" }
};
