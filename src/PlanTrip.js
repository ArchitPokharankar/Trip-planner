// src/PlanTrip.js
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { db, auth } from "./firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function PlanTrip() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hey! I’m your VoyageMate planner. Tell me about the trip you'd like to plan! ✈️🌍",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState(null);

  const scrollRef = useRef(null);

  // Robust handler for server responses
  const handleServerResponse = (data) => {
    // Common shapes:
    // 1) { assistant_message: "...", plan: {...} }
    // 2) { destination: "...", days: 3, itinerary: [...] } (direct plan)
    // 3) plain string (assistant text)
    let assistant_message = null;
    let plan = null;

    if (!data) {
      assistant_message = "Sorry — no response from server.";
    } else if (typeof data === "string") {
      assistant_message = data;
    } else if (data.assistant_message || data.plan !== undefined) {
      assistant_message = data.assistant_message ?? null;
      plan = data.plan ?? null;
    } else if (data.destination && data.itinerary) {
      // server returned a plan object directly
      plan = data;
      assistant_message = "Here's the plan I generated for you.";
    } else {
      // unknown shape, stringify as a fallback
      assistant_message = JSON.stringify(data).slice(0, 1000);
    }

    // Add assistant message to chat if present
    if (assistant_message) {
      setMessages((prev) => [...prev, { role: "assistant", content: assistant_message }]);
    }

    if (plan) setItinerary(plan);
  };

  // Send message and call backend
  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const newMsgs = [...messages, { role: "user", content: text.trim() }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/api/chat-plan", { messages: newMsgs });
      // backend returns { assistant_message: "...", plan: {...} } or fallback
      handleServerResponse(res.data);
    } catch (err) {
      console.error("chat-plan error:", err);
      // if server returned an error message body, attempt to show it
      const fallback = err.response?.data ?? { assistant_message: "Sorry, I couldn't reach the server." };
      handleServerResponse(fallback);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Save plan to Firestore
  const savePlan = async () => {
    if (!itinerary) {
      alert("No plan to save.");
      return;
    }
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        alert("Please login to save a trip!");
        return;
      }

      await addDoc(collection(db, "users", uid, "trips"), {
        title: itinerary.destination || "Untitled Trip",
        ...itinerary,
        chatHistory: messages,
        createdAt: serverTimestamp(),
      });
      alert("Trip saved to My Trips ✅");
    } catch (err) {
      console.error("savePlan error:", err);
      alert("Could not save the trip.");
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={{ margin: 0 }}>Plan Trip</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Chat to generate a day-by-day itinerary. Refine as you go.
        </p>
      </div>

      {/* Main content */}
      <div style={styles.content}>
        {/* Chat */}
        <div style={styles.chat}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.bubble,
                background: m.role === "assistant" ? "#eef2ff" : "#e5e7eb",
                alignSelf: m.role === "assistant" ? "flex-start" : "flex-end",
              }}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div style={{ ...styles.bubble, background: "#eef2ff", alignSelf: "flex-start" }}>
              🤔 Thinking...
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Preview */}
        <div style={styles.sidebar}>
          <h3 style={{ marginTop: 0 }}>Plan Preview</h3>
          {!itinerary ? (
            <p style={{ color: "#6b7280" }}>
              After you share trip details, a structured plan will appear here.
            </p>
          ) : (
            <div style={styles.planBox}>
              <h2 style={styles.planTitle}>{itinerary.destination}</h2>
              <p style={styles.planSubtitle}>
                {itinerary.days}-Day Itinerary
              </p>

              {Array.isArray(itinerary.itinerary) && itinerary.itinerary.map((dayPlan, idx) => (
                <div key={idx} style={styles.dayCard}>
                  <h4 style={styles.dayTitle}>
                    Day {dayPlan.day}: {dayPlan.title}
                  </h4>
                  <strong>Activities:</strong>
                  <ul style={styles.list}>
                    {(dayPlan.activities || []).map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                  <strong>Food Suggestions:</strong>
                  <p style={styles.foodText}>{dayPlan.food_suggestions}</p>
                </div>
              ))}

              <button style={styles.saveBtn} onClick={savePlan}>
                Save to My Trips
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={styles.chatInput}
          disabled={loading}
        />
        <button style={styles.sendBtn} type="submit" disabled={loading}>
          ➤
        </button>
      </form>
    </div>
  );
}

// Styles (same look & feel you used before)
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "sans-serif",
    background: "#f9fafb",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
  },
  content: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: 24,
    padding: 24,
    overflow: "hidden",
  },
  chat: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: 8,
    maxWidth: "80%",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    padding: "12px 24px",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    gap: "10px",
  },
  chatInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
    fontSize: "16px",
  },
  sendBtn: {
    width: "45px",
    height: "45px",
    borderRadius: "50%",
    border: "none",
    background: "black",
    color: "white",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebar: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    overflowY: "auto",
  },
  planBox: { borderRadius: 8, padding: 12 },
  planTitle: { margin: "0 0 4px 0" },
  planSubtitle: { margin: "0 0 16px 0", color: "#6b7280", fontWeight: "bold" },
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
  saveBtn: {
    marginTop: 16,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "none",
    background: "#10B981",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
  },
};
