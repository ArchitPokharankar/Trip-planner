// src/SavedListPage.js
import React from "react";
import { useSavedList } from "./SavedListContext";

export default function SavedListPage() {
  const { savedHotels, removeFromSaved } = useSavedList();

  return (
    <div style={{ padding: "24px" }}>
      <h1>My Saved Hotels</h1>
      {savedHotels.length === 0 ? (
        <p>No hotels saved yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {savedHotels.map((hotel) => (
            <div
              key={hotel.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <h3>{hotel.name}</h3>
              <p>{hotel.price}</p>
              <button onClick={() => removeFromSaved(hotel.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
