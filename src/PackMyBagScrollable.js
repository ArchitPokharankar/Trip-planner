// PackMyBagScrollable.js
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { db, auth } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function PackMyBagScrollable() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledTrip = location.state?.trip || null;

  const [destination, setDestination] = useState(prefilledTrip?.destination || "");
  const [duration, setDuration] = useState(prefilledTrip?.duration || 3);
  const [activities, setActivities] = useState(prefilledTrip?.activities || "");
  const [season, setSeason] = useState(prefilledTrip?.season || "Summer");

  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefilledTrip) {
      generateList(prefilledTrip.destination, prefilledTrip.duration, prefilledTrip.activities, prefilledTrip.season);
    }
    // eslint-disable-next-line
  }, [prefilledTrip]);

  const normalizeApiResponse = (payload) => {
    if (!payload) return null;
    const raw = Array.isArray(payload) ? payload : payload.packingList || payload.list || [];
    return raw.map((c) => ({
      category: c.category || "Misc",
      items: (c.items || c.items_list || []).map((it) => ({
        text: typeof it === "string" ? it : it.text || it.name || "Item",
        packed: !!it.packed,
      })),
    }));
  };

  const generateList = async (dest, dur, acts, seas) => {
    setLoading(true);
    setError(null);
    setCategories(null);
    try {
      const res = await axios.post("/api/generate-packing-list", {
        destination: dest,
        duration: dur,
        activities: acts,
        season: seas,
      });
      const normalized = normalizeApiResponse(res.data);
      const withPacked = normalized.map((c) => ({
        ...c,
        items: c.items.map((it) => ({ ...it, packed: !!it.packed })),
      }));
      setCategories(withPacked);
    } catch (err) {
      console.error("generateList error:", err);
      setError("Could not generate packing list. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSubmit = (e) => {
    e.preventDefault();
    generateList(destination, duration, activities, season);
  };

  const togglePacked = (catIdx, itemIdx) => {
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items[itemIdx].packed = !copy[catIdx].items[itemIdx].packed;
      return copy;
    });
  };

  const addItem = (catIdx, text) => {
    if (!text || !text.trim()) return;
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items.push({ text: text.trim(), packed: false });
      return copy;
    });
  };

  const removeItem = (catIdx, itemIdx) => {
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items.splice(itemIdx, 1);
      return copy;
    });
  };

  const addCategory = (name) => {
    if (!name || !name.trim()) return;
    setCategories((prev) => {
      const copy = prev ? JSON.parse(JSON.stringify(prev)) : [];
      copy.push({ category: name.trim(), items: [] });
      return copy;
    });
  };

  const totalItems = categories ? categories.reduce((acc, c) => acc + (c.items?.length || 0), 0) : 0;
  const packedItems = categories ? categories.reduce((acc, c) => acc + (c.items?.filter((i) => i.packed)?.length || 0), 0) : 0;
  const progress = totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100);

  const handleSave = async () => {
    if (!categories) return alert("Nothing to save");
    const user = auth.currentUser;
    if (!user) return alert("Please login to save");

    setSaving(true);
    try {
      const docId = `packing_${Date.now()}`;
      await setDoc(doc(db, "users", user.uid, "packingLists", docId), {
        type: "packingList",
        tripRef: prefilledTrip?.id || null,
        destination,
        duration,
        activities,
        season,
        categories: JSON.parse(JSON.stringify(categories)),
        createdAt: serverTimestamp(),
      });
      alert("Packing list saved ✅");
    } catch (err) {
      console.error("save error:", err);
      alert("Could not save packing list");
    } finally {
      setSaving(false);
    }
  };

  const itemEmoji = (text) => {
    const t = (text || "").toLowerCase();
    if (t.includes("shirt") || t.includes("pants")) return "👕";
    if (t.includes("shoe")) return "👟";
    if (t.includes("sunglass")) return "🕶";
    if (t.includes("charger") || t.includes("power")) return "🔌";
    if (t.includes("camera") || t.includes("phone")) return "📷";
    if (t.includes("tooth") || t.includes("soap")) return "🧴";
    if (t.includes("passport") || t.includes("ticket")) return "📄";
    return "🎒";
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.moodCard}>
          <div>
            <div style={styles.tripTitle}>✈️ Trip to {destination || (prefilledTrip?.destination ?? "—")}</div>
            <div style={styles.tripMeta}>
              <span>{duration} days</span>•<span>{season}</span>•<span>{activities || "—"}</span>
            </div>
            <div style={styles.suggestText}>Suggested items for your journey</div>
          </div>
          <div>
            <button style={styles.smallBtn} onClick={() => navigate(-1)}>⬅ Back</button>
            <button style={{ ...styles.smallBtn, marginLeft: 8 }} onClick={() => { setCategories(null); setDestination(""); setDuration(3); setActivities(""); setSeason("Summer"); }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Suitcase */}
      <div style={styles.section}>
        <h2>🧳 My Suitcase</h2>
        <div style={styles.progressWrap}>
          <div>{packedItems}/{totalItems} packed ({progress}%)</div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={styles.section}>
        <form onSubmit={handleGenerateSubmit}>
          <div style={styles.row}>
            <label>Destination</label>
            <input style={styles.input} value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </div>
          <div style={styles.row}>
            <label>Duration (days)</label>
            <input style={styles.input} type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
          </div>
          <div style={styles.row}>
            <label>Activities</label>
            <input style={styles.input} value={activities} onChange={(e) => setActivities(e.target.value)} />
          </div>
          <div style={styles.row}>
            <label>Season</label>
            <select style={styles.input} value={season} onChange={(e) => setSeason(e.target.value)}>
              <option>Summer</option><option>Autumn</option><option>Winter</option><option>Spring</option>
            </select>
          </div>
          <button type="submit" style={styles.primaryBtn} disabled={loading}>{loading ? "Generating…" : "✨ Generate"}</button>
        </form>
      </div>

      {/* Generated List */}
      <div style={styles.section}>
        {error && <div style={{ color: "red" }}>{error}</div>}
        {!categories && !loading && <div style={{ color: "#9ca3af" }}>Generate a packing list or prefill from trip.</div>}

        {categories && categories.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 20 }}>
            <h3>{cat.category} ({cat.items.length} items)</h3>
            <div style={styles.cardGrid}>
              {cat.items.map((it, ii) => (
                <div key={ii} style={{ ...styles.itemCard, opacity: it.packed ? 0.5 : 1 }}>
                  <div>{itemEmoji(it.text)} {it.text}</div>
                  <button style={styles.packBtn} onClick={() => togglePacked(ci, ii)}>{it.packed ? "Packed" : "Pack"}</button>
                  <button style={styles.deleteBtn} onClick={() => removeItem(ci, ii)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 12 }}>
          <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "💾 Save List"}</button>
          <button style={styles.ghostBtn} onClick={() => navigate("/saved-packing-lists")}>📂 View Saved</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Inter, sans-serif", background: "#f7fafc", padding: 20 },
  topBar: { display: "flex", justifyContent: "center", marginBottom: 20 },
  moodCard: { width: "100%", maxWidth: 900, background: "#fff", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  tripTitle: { fontSize: 20, fontWeight: "bold" },
  tripMeta: { color: "#6b7280", fontSize: 14, marginTop: 4 },
  suggestText: { marginTop: 8, color: "#374151" },
  smallBtn: { padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#f9fafb", cursor: "pointer" },

  section: { background: "#fff", padding: 16, borderRadius: 10, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  row: { marginBottom: 10, display: "flex", flexDirection: "column" },
  input: { padding: 8, borderRadius: 6, border: "1px solid #ddd" },
  primaryBtn: { background: "#ff6b35", color: "#fff", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer" },
  ghostBtn: { background: "#fff", color: "#374151", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" },

  progressWrap: { marginTop: 8 },
  progressBar: { background: "#eee", height: 8, borderRadius: 20, marginTop: 4 },
  progressFill: { background: "#06b6d4", height: "100%", borderRadius: 20 },

  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginTop: 10 },
  itemCard: { background: "#f8fafc", padding: 10, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 6 },
  packBtn: { padding: "4px 8px", borderRadius: 6, border: "none", background: "#06b6d4", color: "#fff", cursor: "pointer" },
  deleteBtn: { background: "#ef4444", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }
};
