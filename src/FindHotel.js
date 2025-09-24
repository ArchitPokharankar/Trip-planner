// src/FindHotel.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { useSavedList } from "./SavedListContext";

export default function FindHotel() {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { savedHotels, addToSaved } = useSavedList();

  // Save hotel via context
  const saveHotel = async (hotel) => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please log in to save hotels.');
      return;
    }

    const payload = {
      id: String(hotel.id || hotel.hotel_id || Date.now()),
      name: hotel.name || "Unknown",
      city: hotel.city || hotel.property?.city || "",
      price: hotel.price || hotel.price?.lead?.formatted || null,
      photoUrl: hotel.photoUrl || null,
      checkoutUrl: hotel.checkoutUrl || null,
      savedAt: new Date()
    };

    try {
      await addToSaved(payload);
      alert('Saved to My Hotels ✅');
    } catch (err) {
      console.error('Error saving hotel:', err);
      alert('Could not save hotel. Check console.');
    }
  };

  // Search hotels
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setHotels([]);

    if (!destination) {
      setError('Please fill in Destination.');
      setLoading(false);
      return;
    }

    try {
      const hotelsResp = await axios.get('/api/search-hotels', {
        params: { city: destination }
      });

      const items = Array.isArray(hotelsResp.data?.data)
        ? hotelsResp.data.data
        : [];

      const cleaned = items.map(h => ({
        id: h.id,
        name: h.name,
        photoUrl: h.photoUrl,
        rating: h.rating,
        reviewCount: h.reviewCount,
        price: h.price,
        checkoutUrl: h.url,
        raw: h,
      }));

      if (cleaned.length === 0) {
        setError('No hotels found. Try a different city.');
      }

      setHotels(cleaned);
    } catch (err) {
      console.error('Search error:', err);
      const message = err.response?.data?.error || err.message || 'Error searching hotels.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const goToSaved = () => navigate('/saved-hotels');

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={styles.backButton} onClick={() => navigate('/')}>←</button>
          <div>
            <h1 style={{ margin: 0 }}>Find a Hotel</h1>
            <p style={{ margin: 0, color: "#6b7280" }}>
              Search for accommodations for your next trip.
            </p>
          </div>
        </div>
        <button style={styles.savedButton} onClick={goToSaved}>★ Saved Hotels</button>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Search Form */}
        <div style={styles.searchContainer}>
          <form onSubmit={handleSearch} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Mumbai, India"
                style={styles.textInput}
              />
            </div>

            <div style={styles.dateGroup}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  style={styles.textInput}
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  style={styles.textInput}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Adults</label>
              <input
                type="number"
                min="1"
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value, 10))}
                style={styles.textInput}
              />
            </div>

            <button style={styles.searchButton} type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Find Hotels'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div style={styles.resultsContainer}>
          {loading && <p>Searching for the best deals...</p>}
          {error && <p style={styles.errorMsg}>{error}</p>}

          <div style={styles.hotelGrid}>
            {hotels.map(hotel => (
              <div key={hotel.id || Math.random()} style={styles.hotelCard}>
                <img
                  src={hotel.photoUrl || 'https://placehold.co/400x300/e5e7eb/6b7280?text=No+Image'}
                  alt={hotel.name}
                  style={styles.hotelImage}
                />
                <div style={styles.hotelInfo}>
                  <h3 style={styles.hotelName}>{hotel.name}</h3>
                  <p style={styles.hotelRating}>
                    {hotel.rating
                      ? `⭐ ${Number(hotel.rating).toFixed(1)} (${hotel.reviewCount ?? 0} reviews)`
                      : 'No reviews yet'}
                  </p>
                  <p style={styles.hotelPrice}>{hotel.price ?? 'Price not available'}</p>
                  <div style={styles.actions}>
                    {hotel.checkoutUrl ? (
                      <a
                        href={hotel.checkoutUrl.startsWith('http')
                          ? hotel.checkoutUrl
                          : `https://www.booking.com${hotel.checkoutUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.viewDealButton}
                      >
                        View Deal
                      </a>
                    ) : (
                      <button style={{ ...styles.viewDealButton, opacity: 0.8 }} disabled>
                        View Deal
                      </button>
                    )}
                    <button
                      style={styles.saveButton}
                      onClick={() => saveHotel(hotel)}
                      disabled={savedHotels.some(h => h.id === String(hotel.id))}
                    >
                      {savedHotels.some(h => h.id === String(hotel.id)) ? 'Saved' : '❤️ Save'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && hotels.length === 0 && !error && (
            <div style={{ textAlign: 'center', paddingTop: 24, color: '#6b7280' }}>
              Try searching for a different city.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  page: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif", background: "#f9fafb" },
  header: { padding: "12px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" },
  backButton: { background: "#000", color: "#fff", border: "none", padding: "8px 10px", borderRadius: "6px", fontSize: "14px", cursor: "pointer", fontWeight: "600" },
  savedButton: { background: "#111827", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "6px", fontSize: "14px", cursor: "pointer", fontWeight: "600" },
  content: { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', padding: '24px', flex: '1 1 auto', minHeight: 0 },
  searchContainer: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '18px', height: 'fit-content' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  inputGroup: { display: 'flex', flexDirection: 'column' },
  dateGroup: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { marginBottom: '6px', fontWeight: '600', color: '#374151' },
  textInput: { width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "14px", boxSizing: 'border-box' },
  searchButton: { padding: "12px 16px", borderRadius: 8, border: "none", background: "black", color: "white", fontSize: "16px", cursor: "pointer", fontWeight: 'bold', marginTop: '8px' },
  resultsContainer: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '18px', overflowY: 'auto', minHeight: 0 },
  errorMsg: { color: '#D32F2F', fontWeight: '700', background: '#FFEBEE', padding: '12px', borderRadius: '6px', marginBottom: 12 },
  hotelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' },
  hotelCard: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' },
  hotelImage: { width: '100%', height: '160px', objectFit: 'cover', backgroundColor: '#f3f4f6' },
  hotelInfo: { padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' },
  hotelName: { margin: '0 0 8px 0', fontSize: '16px' },
  hotelRating: { margin: '0 0 10px 0', fontSize: '14px', color: '#6b7280' },
  hotelPrice: { margin: 0, fontWeight: '700', fontSize: '16px', marginBottom: '12px' },
  actions: { marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: '10px' },
  viewDealButton: { backgroundColor: '#ff6b35', color: 'white', padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '14px', border: 'none' },
  saveButton: { backgroundColor: '#ef4444', color: 'white', padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }
};
