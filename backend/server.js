// backend/server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import csv from "csvtojson";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

console.log("🔑 GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Loaded ✅" : "Missing ❌");
console.log("🔑 COHERE_API_KEY:", process.env.COHERE_API_KEY ? "Loaded ✅" : "Missing ❌");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load Kaggle dataset once at startup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let hotelsData = [];
csv()
  .fromFile(path.join(__dirname, "data", "india_hotels.csv")) // keep dataset in backend/data/
  .then((jsonObj) => {
    hotelsData = jsonObj;
    console.log(`🏨 Loaded ${hotelsData.length} hotels from Kaggle dataset`);
  })
  .catch((err) => {
    console.warn("Could not load hotels CSV:", err.message || err);
  });

// --- AI routes (unchanged) ---
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      { contents: [{ parts: [{ text: prompt }] }] },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );
    res.json({ text: response.data.candidates[0].content.parts[0].text });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Error calling Gemini API" });
  }
});

app.post("/api/cohere", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await axios.post(
      "https://api.cohere.ai/v1/generate",
      { model: "command-r-plus", prompt, max_tokens: 200 },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json({ text: response.data.generations[0].text });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Error calling Cohere API" });
  }
});

// --- Generate Trip ---
app.post("/api/generate-trip", async (req, res) => {
  try {
    const { destination = "your destination", days = 3 } = req.body;
    const prompt = `
      Plan a detailed travel itinerary for a ${days}-day trip to ${destination}.
      Your response MUST be a JSON object only (no leading/trailing text). Format:
      {
        "destination": "${destination}",
        "days": ${days},
        "itinerary": [
          {
            "day": 1,
            "title": "Title for day 1",
            "activities": ["activity1","activity2"],
            "food_suggestions": "some suggestion"
          }
        ]
      }
    `;

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    const itineraryObject = JSON.parse(responseText);
    res.json(itineraryObject);
  } catch (error) {
    console.error("generate-trip error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate trip" });
  }
});

// --- Chat Plan ---
// Returns: { assistant_message: "...", plan: {...} | null }
app.post("/api/chat-plan", async (req, res) => {
  try {
    const { messages } = req.body;

    // Clear system instructions - we require the model to return JSON:
    const systemPrompt = `
You are VoyageMate, a friendly AI travel planner.
When the user gives their preferences, your response MUST be valid JSON (no extra text) in the following shape:

{
  "assistant_message": "<short natural sentence reply to user>",
  "plan": {
    "destination": "<destination string>",
    "days": <number>,
    "itinerary": [
      {
        "day": <number>,
        "title": "<title>",
        "activities": ["<activity1>", "<activity2>"],
        "food_suggestions": "<string>"
      }
    ]
  }
}

If you cannot produce a full 'plan' yet, set "plan": null and still provide "assistant_message".
Only output JSON with those keys. Do not include any explanation outside JSON.
`;

    const conversationText = JSON.stringify(messages || []);
    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt + "\n\nConversation:\n" + conversationText }],
      },
    ];

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      { contents, generationConfig: { responseMimeType: "application/json" } },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.warn("No responseText from Gemini:", response.data);
      return res.json({
        assistant_message: "Sorry — I didn't get a response from the AI.",
        plan: null,
      });
    }

    // Try to parse the response as JSON first
    try {
      const parsed = JSON.parse(responseText);
      // If parsed is a string, wrap it
      if (typeof parsed === "string") {
        return res.json({ assistant_message: parsed, plan: null });
      }
      // Ensure keys exist
      const assistant_message = parsed.assistant_message ?? (typeof parsed === "string" ? parsed : null);
      const plan = parsed.plan ?? null;
      return res.json({ assistant_message, plan });
    } catch (parseErr) {
      // If parsing fails, try to extract a JSON substring (best-effort)
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}$/);
        if (jsonMatch) {
          const cleaned = jsonMatch[0];
          const parsed = JSON.parse(cleaned);
          const assistant_message = parsed.assistant_message ?? null;
          const plan = parsed.plan ?? null;
          return res.json({ assistant_message, plan });
        }
      } catch (innerErr) {
        // fall through to fallback
      }

      // Fallback: return entire text as assistant_message and no plan
      return res.json({
        assistant_message: responseText,
        plan: null,
      });
    }
  } catch (error) {
    console.error("chat-plan error:", error.response?.data || error.message);
    res.status(500).json({ assistant_message: "Sorry, I encountered an error.", plan: null });
  }
});

// --- 🔄 Hotels via Kaggle dataset --- //
// ✅ Simplified: Search hotels by city/area only
app.get("/api/search-hotels", (req, res) => {
  try {
    const { city, area } = req.query;

    if (!city && !area) {
      return res.status(400).json({ error: "City or area is required" });
    }

    let filtered = hotelsData;

    if (city) {
      filtered = filtered.filter(
        (h) => h.city && h.city.toLowerCase().includes(city.toLowerCase())
      );
    }

    if (area) {
      filtered = filtered.filter(
        (h) => h.area && h.area.toLowerCase().includes(area.toLowerCase())
      );
    }

    const result = filtered.slice(0, 20).map((hotel) => ({
      id: hotel.property_id,
      name: hotel.property_name,
      photoUrl: hotel.image_urls?.split(",")[0] || null,
      rating: parseFloat(hotel.site_review_rating) || null,
      reviewCount: parseInt(hotel.site_review_count) || 0,
      price: hotel.highlight_value || "N/A",
      address: hotel.property_address,
      city: hotel.city,
      state: hotel.state,
      url: hotel.pageurl,
    }));

    res.json({ data: result });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to search hotels" });
  }
});

// ✅ Get hotel details
app.get("/api/hotel-details/:hotel_id", (req, res) => {
  try {
    const { hotel_id } = req.params;
    const hotel = hotelsData.find((h) => h.property_id === hotel_id);
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    res.json({
      id: hotel.property_id,
      name: hotel.property_name,
      overview: hotel.hotel_overview,
      rating: hotel.hotel_star_rating,
      traveller_rating: hotel.traveller_rating,
      address: hotel.property_address,
      city: hotel.city,
      state: hotel.state,
      reviews: hotel.site_review_count,
      url: hotel.pageurl,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch hotel details" });
  }
});

// --- Pack My Bag (unchanged) ---
app.post("/api/generate-packing-list", async (req, res) => {
  try {
    const { destination, duration, activities, season } = req.body;

    const prompt = `
      You are an expert travel packer. Generate a detailed, categorized packing list.
      Trip Details: ${destination}, ${duration} days, Activities: ${activities}, Season: ${season}
      Response: JSON with "packingList" key -> array of { category, items:[{text, packed:false}] }
    `;

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    res.json(JSON.parse(responseText));
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate packing list" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));

let users = [
  {
    id: "user1",
    uid: "firebase-uid-1",
    displayName: "Archit Pokharankar",
    email: "pokharankararchit@gmail.com",
    password: "hashedPassword123", // In real app, this should be properly hashed
    photoURL: "https://i.pravatar.cc/80?img=1",
    accessToken: "mock-token-123"
  }
];

// --- Profile Management Routes ---

// ✅ Update Profile (Name/Email)
app.put("/api/user/update-profile", async (req, res) => {
  try {
    const { name, email, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Find user by ID or uid
    const userIndex = users.findIndex(u => u.id === userId || u.uid === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user data
    if (name) {
      users[userIndex].displayName = name;
    }
    
    if (email) {
      // Check if email already exists for another user
      const emailExists = users.some(u => 
        u.email === email && (u.id !== userId && u.uid !== userId)
      );
      
      if (emailExists) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      users[userIndex].email = email;
    }

    const updatedUser = { ...users[userIndex] };
    delete updatedUser.password; // Don't send password back

    console.log(`✅ Profile updated for user ${userId}:`, { name, email });
    
    res.json({ 
      message: "Profile updated successfully", 
      user: updatedUser 
    });

  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ✅ Update Password
app.post("/api/user/update-password", async (req, res) => {
  try {
    const { currentPassword, newPassword, userId } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: "User ID, current password, and new password are required" 
      });
    }

    // Find user
    const userIndex = users.findIndex(u => u.id === userId || u.uid === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[userIndex];

    // In a real app, you'd use bcrypt.compare() here
    // For demo purposes, we'll do a simple string comparison
    if (user.password !== currentPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password must be at least 6 characters long" 
      });
    }

    // Update password (in real app, hash it with bcrypt)
    users[userIndex].password = newPassword;

    console.log(`✅ Password updated for user ${userId}`);
    
    res.json({ message: "Password updated successfully" });

  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

// ✅ Get User Profile
app.get("/api/user/profile/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = users.find(u => u.id === userId || u.uid === userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userProfile = { ...user };
    delete userProfile.password; // Don't send password
    
    res.json(userProfile);
    
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ✅ Mock Authentication Route (for testing)
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userResponse = { ...user };
    delete userResponse.password;
    
    res.json({ 
      message: "Login successful", 
      user: userResponse,
      token: `mock-token-${user.id}`
    });
    
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ For debugging - Get all users (remove in production)
app.get("/api/debug/users", (req, res) => {
  const safeUsers = users.map(u => ({ ...u, password: "***hidden***" }));
  res.json(safeUsers);
});


