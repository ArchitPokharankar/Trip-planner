// PlanTrip.jsx
import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CohereClient } from "cohere-ai";

// ✅ Load API keys from environment (create .env file in root)
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
const cohere = new CohereClient({ token: process.env.REACT_APP_COHERE_API_KEY });

function PlanTrip() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! Tell me where you want to go and your preferences ✈️🌍" }
  ]);
  const [input, setInput] = useState("");
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle chat with Gemini
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent([input]);

      const botReply = result.response.text();
      setMessages((prev) => [...prev, { role: "bot", text: botReply }]);
    } catch (error) {
      console.error("Gemini error:", error);
    }

    setInput("");
  };

  // Generate trip itinerary with Cohere
  const generateItinerary = async () => {
    setLoading(true);

    // Collect all user messages into one string
    const userInputs = messages
      .filter((m) => m.role === "user")
      .map((m) => m.text)
      .join(" ");

    try {
      const response = await cohere.generate({
        model: "command-r-plus", // Cohere best for structured outputs
        prompt: `Generate a detailed trip itinerary in JSON format.
                 User preferences: ${userInputs}
                 Structure it like:
                 {
                   "destination": "...",
                   "days": [
                     {
                       "day": 1,
                       "activities": ["..."],
                       "budget_estimate": "..."
                     }
                   ],
                   "total_budget": "..."
                 }`,
        max_tokens: 500
      });

      const text = response.generations[0].text;
      const parsed = JSON.parse(text); // Cohere usually outputs valid JSON
      setTripData(parsed);
    } catch (error) {
      console.error("Cohere error:", error);
      alert("Failed to generate itinerary. Try again.");
    }

    setLoading(false);
  };

  return (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      {/* Chat Section */}
      <div style={{ flex: 1, border: "1px solid #ccc", borderRadius: "10px", padding: "15px" }}>
        <h2>Trip Planner Chat 💬</h2>
        <div style={{ height: "300px", overflowY: "auto", marginBottom: "10px" }}>
          {messages.map((msg, i) => (
            <p key={i} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
              <b>{msg.role === "user" ? "You" : "Bot"}:</b> {msg.text}
            </p>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your trip details..."
          style={{ width: "80%", padding: "8px" }}
        />
        <button onClick={handleSend} style={{ padding: "8px 12px", marginLeft: "5px" }}>
          Send
        </button>
        <button onClick={generateItinerary} style={{ padding: "8px 12px", marginLeft: "5px" }}>
          Generate Trip
        </button>
      </div>

      {/* Trip Preview Section */}
      <div style={{ flex: 1, border: "1px solid #ccc", borderRadius: "10px", padding: "15px" }}>
        <h2>Trip Preview 🗺️</h2>
        {loading && <p>Generating itinerary...</p>}
        {!loading && tripData && (
          <div>
            <h3>{tripData.destination}</h3>
            {tripData.days.map((day, i) => (
              <div key={i}>
                <h4>Day {day.day}</h4>
                <ul>
                  {day.activities.map((act, j) => (
                    <li key={j}>{act}</li>
                  ))}
                </ul>
                <p><b>Budget:</b> {day.budget_estimate}</p>
              </div>
            ))}
            <h3>Total Budget: {tripData.total_budget}</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlanTrip;
