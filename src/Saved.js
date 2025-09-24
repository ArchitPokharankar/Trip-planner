// src/Saved.js
import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function Saved() {
  const [savedTrips, setSavedTrips] = useState([]);
  const [savedPackages, setSavedPackages] = useState([]);
  const [savedBudget, setSavedBudget] = useState(null);
  const [savedHotels, setSavedHotels] = useState([]);
  const [savedPackingLists, setSavedPackingLists] = useState([]);
  const [savedTodos, setSavedTodos] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchAll = async () => {
      try {
        const uid = auth.currentUser.uid;

        // 1️⃣ Fetch Saved Trips with itinerary from MyTrips
        const tripsRef = collection(db, "users", uid, "savedTrips");
        const tripsSnap = await getDocs(tripsRef);
        const tripsWithItinerary = await Promise.all(
          tripsSnap.docs.map(async (docSnap) => {
            const data = docSnap.data();
            // Fetch the trip document from MyTrips
            const tripDoc = await getDoc(doc(db, "users", uid, "myTrips", data.tripId));
            return {
              id: docSnap.id,
              ...data,
              itinerary: tripDoc.exists() ? tripDoc.data().itinerary : "Itinerary not found",
            };
          })
        );
        setSavedTrips(tripsWithItinerary);

        // 2️⃣ Saved Packages
        const packagesRef = collection(db, "users", uid, "savedPackages");
        const packagesSnap = await getDocs(packagesRef);
        setSavedPackages(packagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 3️⃣ Hotels
        const hotelsRef = collection(db, "users", uid, "savedHotels");
        const hotelsSnap = await getDocs(hotelsRef);
        setSavedHotels(hotelsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 4️⃣ Packing Lists
        const packingRef = query(
          collection(db, "users", uid, "packingLists"),
          orderBy("createdAt", "desc")
        );
        const packingSnap = await getDocs(packingRef);
        setSavedPackingLists(packingSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 5️⃣ ToDos
        const todosRef = collection(db, "users", uid, "todos");
        const todosSnap = await getDocs(todosRef);
        setSavedTodos(todosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 6️⃣ Budget
        const budgetRef = doc(db, "users", uid, "budgetPlanner", "saved");
        const budgetSnap = await getDoc(budgetRef);
        if (budgetSnap.exists()) setSavedBudget({ id: budgetSnap.id, ...budgetSnap.data() });

      } catch (err) {
        console.error("Error fetching saved data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // 🔹 Delete function
  const handleDelete = async (collectionPath, id, stateSetter) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    try {
      await deleteDoc(doc(db, ...collectionPath.split("/"), id));
      stateSetter((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading saved data…</div>;

  const buttonStyle = {
    fontSize: "0.7rem",
    padding: "2px 6px",
    marginLeft: 6,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#fff",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Back button */}
      <div style={{ padding: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "6px 10px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          ← Back
        </button>
      </div>

      {/* Scrollable container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 20px 20px 20px",
        }}
      >
        <h1>📂 Saved Items</h1>

        {/* 1. Saved Trips */}
        <section>
          <h2>🎁 Saved Trips</h2>
          {savedTrips.length ? (
            savedTrips.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{p.name}</strong> — {p.destination}
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Itinerary: {p.itinerary}
                  </div>
                </div>
                <div>
                  <button
                    style={buttonStyle}
                    onClick={() => navigate(`/edit-trip/${p.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ ...buttonStyle, color: "red" }}
                    onClick={() =>
                      handleDelete(
                        `users/${auth.currentUser.uid}/savedTrips`,
                        p.id,
                        setSavedTrips
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No trips saved yet.</p>
          )}
        </section>

        {/* 2. Saved Packages */}
        <section>
          <h2>📦 Saved Packages</h2>
          {savedPackages.length ? (
            savedPackages.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{p.name}</strong> — {p.destination}
                </div>
                <div>
                  <button
                    style={buttonStyle}
                    onClick={() => navigate(`/edit-package/${p.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ ...buttonStyle, color: "red" }}
                    onClick={() =>
                      handleDelete(
                        `users/${auth.currentUser.uid}/savedPackages`,
                        p.id,
                        setSavedPackages
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No packages saved yet.</p>
          )}
        </section>

        {/* 3. Hotels */}
        <section>
          <h2>🏨 Saved Hotels</h2>
          {savedHotels.length ? (
            savedHotels.map((h) => (
              <div
                key={h.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{h.name}</strong> — {h.city}
                  <div>Price: {h.price ?? "N/A"}</div>
                  {h.photoUrl && (
                    <img
                      src={h.photoUrl}
                      alt={h.name}
                      style={{ width: "120px", borderRadius: 6, marginTop: 6 }}
                    />
                  )}
                </div>
                <div>
                  <button
                    style={buttonStyle}
                    onClick={() => navigate(`/edit-hotel/${h.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ ...buttonStyle, color: "red" }}
                    onClick={() =>
                      handleDelete(
                        `users/${auth.currentUser.uid}/savedHotels`,
                        h.id,
                        setSavedHotels
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No hotels saved yet.</p>
          )}
        </section>

        {/* 4. Packing Lists */}
        <section>
          <h2>🎒 Saved Packing Lists</h2>
          {savedPackingLists.length ? (
            savedPackingLists.map((list) => (
              <div
                key={list.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>Trip to {list.destination}</strong> — {list.duration} days
                  <div>Season: {list.season}</div>
                  <div>Activities: {list.activities}</div>
                  <ul>
                    {(list.categories || []).map((cat, i) => (
                      <li key={i}>
                        <strong>{cat.category}:</strong>{" "}
                        {cat.items.map((it) => it.text).join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <button
                    style={buttonStyle}
                    onClick={() => navigate(`/edit-packing/${list.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    style={{ ...buttonStyle, color: "red" }}
                    onClick={() =>
                      handleDelete(
                        `users/${auth.currentUser.uid}/packingLists`,
                        list.id,
                        setSavedPackingLists
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No packing lists saved yet.</p>
          )}
        </section>

        {/* 5. Budget */}
        <section>
          <h2>💸 Saved Budget Plan</h2>
          {savedBudget?.planCategories?.length ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                border: "1px solid #ddd",
                padding: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div>Saved At: {new Date(savedBudget.savedAt).toLocaleString("en-IN")}</div>
                <ul>
                  {savedBudget.planCategories.map((cat, i) => (
                    <li key={i}>
                      {cat.name} — ₹{cat.allocatedBudget} {cat.tag ? `(${cat.tag})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <button
                  style={buttonStyle}
                  onClick={() => navigate(`/edit-budget/${savedBudget.id}`)}
                >
                  Edit
                </button>
                <button
                  style={{ ...buttonStyle, color: "red" }}
                  onClick={() =>
                    handleDelete(
                      `users/${auth.currentUser.uid}/budgetPlanner/saved`,
                      savedBudget.id,
                      setSavedBudget
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <p>No saved budget plan yet.</p>
          )}
        </section>

        {/* 6. ToDos */}
        <section>
          <h2>✅ Saved To-Do List</h2>
          {savedTodos.length ? (
            <ul>
              {savedTodos.map((t) => (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  {t.text} {t.completed ? "✔️" : ""}
                  <span style={{ float: "right" }}>
                    <button
                      style={buttonStyle}
                      onClick={() => navigate(`/edit-todo/${t.id}`)}
                    >
                      Edit
                    </button>
                    <button
                      style={{ ...buttonStyle, color: "red" }}
                      onClick={() =>
                        handleDelete(
                          `users/${auth.currentUser.uid}/todos`,
                          t.id,
                          setSavedTodos
                        )
                      }
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No todos saved yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default Saved;
