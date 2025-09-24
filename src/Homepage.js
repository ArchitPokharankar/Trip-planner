// src/Homepage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Homepage.css";

// ✅ Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function Homepage({ user, onProfileClick, onLogout }) {
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";
  const displayImage = user?.photoURL || "https://i.pravatar.cc/50";

  const navigate = useNavigate();

  // ✅ Expanded hotspots (global + India)
  const hotspots = [
    // Global
    { name: "Paris, France", coords: [48.8566, 2.3522] },
    { name: "New York, USA", coords: [40.7128, -74.006] },
    { name: "Tokyo, Japan", coords: [35.6762, 139.6503] },
    { name: "Sydney, Australia", coords: [-33.8688, 151.2093] },
    { name: "London, UK", coords: [51.5074, -0.1278] },
    { name: "Rome, Italy", coords: [41.9028, 12.4964] },
    { name: "Dubai, UAE", coords: [25.276987, 55.296249] },
    { name: "Singapore", coords: [1.3521, 103.8198] },
    { name: "Bangkok, Thailand", coords: [13.7563, 100.5018] },
    { name: "Bali, Indonesia", coords: [-8.4095, 115.1889] },
    { name: "Cape Town, South Africa", coords: [-33.9249, 18.4241] },
    { name: "Barcelona, Spain", coords: [41.3851, 2.1734] },
    { name: "Berlin, Germany", coords: [52.52, 13.405] },
    { name: "Istanbul, Turkey", coords: [41.0082, 28.9784] },
    { name: "Moscow, Russia", coords: [55.7558, 37.6173] },
    { name: "Rio de Janeiro, Brazil", coords: [-22.9068, -43.1729] },
    { name: "Los Angeles, USA", coords: [34.0522, -118.2437] },
    { name: "San Francisco, USA", coords: [37.7749, -122.4194] },
    { name: "Toronto, Canada", coords: [43.65107, -79.347015] },
    { name: "Mexico City, Mexico", coords: [19.4326, -99.1332] },
    { name: "Cairo, Egypt", coords: [30.0444, 31.2357] },
    { name: "Athens, Greece", coords: [37.9838, 23.7275] },
    { name: "Venice, Italy", coords: [45.4408, 12.3155] },
    { name: "Machu Picchu, Peru", coords: [-13.1631, -72.545] },
    { name: "Hong Kong", coords: [22.3193, 114.1694] },

    // India
    { name: "Delhi, India", coords: [28.6139, 77.209] },
    { name: "Mumbai, India", coords: [19.076, 72.8777] },
    { name: "Goa, India", coords: [15.2993, 74.124] },
    { name: "Jaipur, India", coords: [26.9124, 75.7873] },
    { name: "Agra, India", coords: [27.1767, 78.0081] },
    { name: "Bengaluru, India", coords: [12.9716, 77.5946] },
    { name: "Kerala, India", coords: [10.8505, 76.2711] },
  ];

  const go = (path) => () => navigate(path);
  const goHomepage = () => navigate("/");

  const ActionButton = ({ primary, children, onClick, extraClass }) => {
    const baseClass = primary ? "action-btn primary" : "action-btn secondary";
    return (
      <button className={`${baseClass} ${extraClass || ""}`} onClick={onClick}>
        {children}
      </button>
    );
  };

  const QuickActions = () => (
    <section className="quick-actions" aria-labelledby="quick-actions">
      <h2 id="quick-actions">Quick Actions</h2>
      <div className="grid two">
        <ActionButton primary onClick={go("/plan-trip")}>
          📅 Plan Trip
        </ActionButton>
        <ActionButton primary onClick={go("/my-trips")}>
          🧳 My Trips
        </ActionButton>
      </div>
      <div className="grid four">
        <ActionButton onClick={go("/book-hotel")} extraClass="secondary">
          <div>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>🏨</div>
            <div style={{ fontWeight: 700 }}>Book A Hotel</div>
          </div>
        </ActionButton>
        <ActionButton onClick={go("/todo")}>
          <div>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>✅</div>
            <div style={{ fontWeight: 700 }}>TO-DO List</div>
          </div>
        </ActionButton>
        <ActionButton onClick={go("/pack-my-bag")}>
          <div>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>🎒</div>
            <div style={{ fontWeight: 700 }}>Pack My Bag</div>
          </div>
        </ActionButton>
        <ActionButton onClick={go("/budget-planner")}>
          <div>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>💸</div>
            <div style={{ fontWeight: 700 }}>Budget Planner</div>
          </div>
        </ActionButton>
      </div>
    </section>
  );

  return (
    <div className="homepage">
      {/* sidebar same */}
      <div className="sidebar" aria-label="Sidebar">
        <div className="logo" onClick={goHomepage}>
          <img src="/logo.png" alt="Logo" style={{ width: "100%" }} />
        </div>

        <div className="profile" onClick={onProfileClick} role="button">
          <img src={displayImage} alt="User" />
          <h2>{displayName}</h2>
          <p>{user ? "Part-time Traveller" : "Click to log in"}</p>
        </div>

        <button className="new-trip" onClick={go("/plan-trip")}>
          + New Trip
        </button>

        <div className="section">
          <h3>Explore</h3>
          <ul>
            <li onClick={() => navigate("/discover")} style={{ cursor: "pointer" }}>
              <span>Discover</span>
              <span>New</span>
            </li>
            <li onClick={() => navigate("/saved")} style={{ cursor: "pointer" }}>
              <span>Saved</span>
              <span>12</span>
            </li>
          </ul>
        </div>

        {user && (
          <button className="logout" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>

      <main className="main-content">
        {/* header same */}
        <header className="main-header">
          <div>
            <h1>Good Morning, {displayName} 👋</h1>
            <p>Plan your itinerary with us</p>
          </div>
          <div className="header-right">
            <span className="date">Sun, 27 Oct</span>
            <button>🔍</button>
            <button>🛠 Got Apps</button>
          </div>
        </header>

        <QuickActions />

        {/* ✅ World Map with no maximize button */}
        <section className="content-section">
          <h2 className="section-heading">Explore</h2>
          <div style={{ position: "relative" }}>
            <MapContainer
              center={[20, 0]}
              zoom={2}
              scrollWheelZoom={true}
              style={{
                width: "100%",
                height: "220px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {hotspots.map((spot, i) => (
                <Marker
                  key={i}
                  position={spot.coords}
                  icon={L.icon({
                    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                  })}
                >
                  <Popup>
                    <strong>{spot.name}</strong>
                    <br />
                    <button
                      style={{
                        marginTop: "6px",
                        padding: "6px 10px",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                      onClick={() => navigate("/plan-trip")}
                    >
                      Plan Trip
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        {/* rest content same */}
        <section>
          <h2 className="section-heading">For your 🇲🇾 Malaysia Trip</h2>
          <div className="grid two">
            <div className="card">
              <h3>Jalan Alor Street Food</h3>
              <p>4.3⭐ (24) | Guide: Vetrick W.</p>
            </div>
            <div className="card">
              <h3>Bukit Bintang Shopping</h3>
              <p>4.5⭐ (40) | Guide: Anika P.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-heading">One Week Itinerary - Japan</h2>
          <div className="card">
            <p>
              Traveller: <strong>Vetrick W.</strong>
            </p>
            <div
              style={{
                display: "flex",
                gap: "16px",
                marginTop: "8px",
                fontSize: "14px",
              }}
            >
              <p>
                Budget: <strong>$1200</strong>
              </p>
              <p>
                Person: <strong>2</strong>
              </p>
              <p>
                Duration: <strong>7d, 6n</strong>
              </p>
            </div>
          </div>
        </section>

        <footer>
          <small>© {new Date().getFullYear()} VoyageMate</small>
          <div style={{ display: "flex", gap: "12px" }}>
            <button>Help</button>
            <button>Privacy</button>
          </div>
        </footer>
      </main>
    </div>
  );
}
