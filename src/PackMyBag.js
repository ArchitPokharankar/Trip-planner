import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { db, auth } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// PackMyBag — Suitcase-style packing UI with categories, progress bar, and Firestore save
export default function PackMyBag() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledTrip = location.state?.trip || null;

  // Form state (prefilled if available)
  const [destination, setDestination] = useState(prefilledTrip?.destination || "");
  const [duration, setDuration] = useState(prefilledTrip?.duration || 3);
  const [activities, setActivities] = useState(prefilledTrip?.activities || "");
  const [season, setSeason] = useState(prefilledTrip?.season || "Summer");

  // Generated packing list: [{ category: 'Clothes', items: [{ text, packed }] }, ...]
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // When prefilled trip exists, auto-generate
  useEffect(() => {
    if (prefilledTrip) {
      // generate using backend API
      generateList(prefilledTrip.destination, prefilledTrip.duration, prefilledTrip.activities, prefilledTrip.season);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledTrip]);

  // Convert API shape to our categories shape (defensive)
  const normalizeApiResponse = (payload) => {
    // Expected payload shape: { packingList: [{ category: 'Clothes', items: [{ text: 'T-shirt' }, ... ] }, ...] }
    if (!payload) return null;
    const raw = Array.isArray(payload) ? payload : payload.packingList || payload.list || [];
    return raw.map((c) => ({
      category: c.category || "Misc",
      items: (c.items || c.items_list || []).map((it) => ({ text: typeof it === 'string' ? it : it.text || it.name || 'Item', packed: !!it.packed }))
    }));
  };

  // API call to generate list
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
      // ensure 'packed' exists for each item
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

  // Handle manual form submit
  const handleGenerateSubmit = (e) => {
    e.preventDefault();
    generateList(destination, duration, activities, season);
  };

  // Toggle packed state
  const togglePacked = (catIdx, itemIdx) => {
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items[itemIdx].packed = !copy[catIdx].items[itemIdx].packed;
      return copy;
    });
  };

  // Add new item to category
  const addItem = (catIdx, text) => {
    if (!text || !text.trim()) return;
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items.push({ text: text.trim(), packed: false });
      return copy;
    });
  };

  // Remove item
  const removeItem = (catIdx, itemIdx) => {
    setCategories((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].items.splice(itemIdx, 1);
      return copy;
    });
  };

  // Add a new category
  const addCategory = (name) => {
    if (!name || !name.trim()) return;
    setCategories((prev) => {
      const copy = prev ? JSON.parse(JSON.stringify(prev)) : [];
      copy.push({ category: name.trim(), items: [] });
      return copy;
    });
  };

  // Progress calculations
  const totalItems = categories ? categories.reduce((acc, c) => acc + (c.items?.length || 0), 0) : 0;
  const packedItems = categories ? categories.reduce((acc, c) => acc + (c.items?.filter((i) => i.packed)?.length || 0), 0) : 0;
  const progress = totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100);

  // Save to Firestore (under /users/{uid}/trips or packingLists depending on your preference)
  const handleSave = async () => {
    if (!categories) return alert("Nothing to save");
    const user = auth.currentUser;
    if (!user) return alert("Please login to save");

    setSaving(true);
    try {
      const docId = `packing_${Date.now()}`;
      // store under packingLists so it is separate from trips
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

  // Small helper to render an emoji/icon for common items (fallback: 🎒)
  const itemEmoji = (text) => {
    const t = (text || "").toLowerCase();
    if (t.includes("shirt") || t.includes("t-shirt") || t.includes("pants") || t.includes("short")) return "👕";
    if (t.includes("shoe") || t.includes("sneak") || t.includes("boot")) return "👟";
    if (t.includes("sunglass") || t.includes("sungla")) return "🕶";
    if (t.includes("charger") || t.includes("power") || t.includes("bank")) return "🔌";
    if (t.includes("camera") || t.includes("phone")) return "📷";
    if (t.includes("tooth") || t.includes("toothbrush") || t.includes("soap") || t.includes("shampoo")) return "🧴";
    if (t.includes("passport") || t.includes("ticket") || t.includes("id")) return "📄";
    return "🎒";
  };

  return (
    // OUTER SCROLLABLE WRAPPER: preserves all functionality but makes the whole page vertically scrollable
    <div style={styles.pageScroll}>
      <div style={styles.page}>
        {/* Top bar / moodboard */}
        <div style={styles.topBar}>
          <div style={styles.moodCard}>
            <div style={styles.moodLeft}>
              <div style={styles.tripTitle}>✈️ Trip to {destination || (prefilledTrip?.destination ?? "—")}</div>
              <div style={styles.tripMeta}>
                <span>{duration} days</span>
                <span>•</span>
                <span>{season}</span>
                <span>•</span>
                <span>{activities || "—"}</span>
              </div>
              <div style={styles.suggestText}>Suggested items for your journey</div>
            </div>
            <div style={styles.moodRight}>
              <button style={styles.smallBtn} onClick={() => navigate(-1)}>⬅ Back</button>
              <button style={{...styles.smallBtn, marginLeft: 8}} onClick={() => { setCategories(null); setDestination(""); setDuration(3); setActivities(""); setSeason("Summer"); }}>Reset</button>
            </div>
          </div>
        </div>

        <div style={styles.container}>
          <div style={styles.leftColumn}>
            {/* Suitcase illustration + category tabs */}
            <div style={styles.suitcaseWrap}>
              <div style={styles.suitcaseHeader}>🧳 My Suitcase</div>

              <div style={styles.suitcaseInner}>
                {/* Sections — visually split into 3 columns in suitcase */}
                <div style={styles.suitSection}>
                  <div style={styles.sectionTitle}>👕 Clothes</div>
                  <div style={styles.sectionList}>
                    {(categories || []).filter(c => c.category.toLowerCase().includes('cloth') || c.category.toLowerCase().includes('clothes') || c.category.toLowerCase().includes('clothing')).flatMap(c => c.items).slice(0,8).map((it, i) => (
                      <div key={i} style={{...styles.suitItem, opacity: it.packed ? 0.45 : 1}}>
                        <span style={{fontSize: 20, marginRight: 8}}>{itemEmoji(it.text)}</span>
                        <small style={{flex:1}}>{it.text}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.suitSection}>
                  <div style={styles.sectionTitle}>🧴 Toiletries</div>
                  <div style={styles.sectionList}>
                  {(categories || []).filter(c => c.category.toLowerCase().includes('toilet') || c.category.toLowerCase().includes('toiletri') || c.category.toLowerCase().includes('wash')).flatMap(c => c.items).slice(0,8).map((it, i) => (
                      <div key={i} style={{...styles.suitItem, opacity: it.packed ? 0.45 : 1}}>
                        <span style={{fontSize: 20, marginRight: 8}}>{itemEmoji(it.text)}</span>
                        <small style={{flex:1}}>{it.text}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.suitSection}>
                  <div style={styles.sectionTitle}>📱 Gadgets</div>
                  <div style={styles.sectionList}>
                  {(categories || []).filter(c => c.category.toLowerCase().includes('gadget') || c.category.toLowerCase().includes('tech') || c.category.toLowerCase().includes('device')).flatMap(c => c.items).slice(0,8).map((it, i) => (
                      <div key={i} style={{...styles.suitItem, opacity: it.packed ? 0.45 : 1}}>
                        <span style={{fontSize: 20, marginRight: 8}}>{itemEmoji(it.text)}</span>
                        <small style={{flex:1}}>{it.text}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={styles.suitcaseFooter}>
                <div style={styles.progressWrap}>
                  <div style={styles.progressText}>{packedItems}/{totalItems} packed</div>
                  <div style={styles.progressBar}>
                    <div style={{...styles.progressFill, width: `${progress}%`}} />
                  </div>
                </div>
              </div>
            </div>

            {/* Generate / Manual form */}
            <div style={styles.formCard}>
              <form onSubmit={handleGenerateSubmit}>
                <div style={styles.row}>
                  <label style={styles.label}>Destination</label>
                  <input
                    style={styles.input}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Goa"
                    required
                  />
                </div>

                <div style={styles.row}>
                  <label style={styles.label}>Duration (days)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    required
                  />
                </div>

                <div style={styles.row}>
                  <label style={styles.label}>Activities</label>
                  <input
                    style={styles.input}
                    value={activities}
                    onChange={(e) => setActivities(e.target.value)}
                    placeholder="beach, sightseeing"
                  />
                </div>

                <div style={styles.row}>
                  <label style={styles.label}>Season</label>
                  <select style={styles.input} value={season} onChange={(e) => setSeason(e.target.value)}>
                    <option>Summer</option>
                    <option>Autumn</option>
                    <option>Winter</option>
                    <option>Spring</option>
                  </select>
                </div>

                <div style={{display: 'flex', gap: 8, marginTop: 10}}>
                  <button type="submit" style={styles.primaryBtn} disabled={loading}>{loading ? 'Generating…' : '✨ Generate'}</button>
                  <button type="button" style={styles.ghostBtn} onClick={() => { setCategories(null); setError(null); }}>Clear</button>
                  <button type="button" style={styles.ghostBtn} onClick={() => { addCategory('Extras'); }}>+ Category</button>
                </div>
              </form>
            </div>
          </div>

          {/* Right column: Tabs + Grid checklist */}
          <div style={styles.rightColumn}>
            <div style={styles.tabBar}>
              {(categories || []).map((c, i) => (
                <div key={i} style={styles.tab}>{c.category}</div>
              ))}
              {(!categories || categories.length === 0) && <div style={styles.tabEmpty}>No categories yet</div>}
            </div>

            <div style={styles.gridArea}>
              {error && <div style={{color: 'red'}}>{error}</div>}

              {!categories && !loading && (
                <div style={styles.placeholder}>Generate a packing list or prefill it from a saved trip.</div>
              )}

              {categories && categories.map((cat, ci) => (
                <div key={ci} style={styles.categoryBlock}>
                  <div style={styles.categoryHeader}>
                    <h3 style={{margin:0}}>{cat.category}</h3>
                    <div style={{display:'flex', gap:8}}>
                      <small style={{alignSelf:'center'}}>{cat.items.length} items</small>
                      <button style={styles.smallIconBtn} onClick={() => { const name = prompt('New item name'); if (name) addItem(ci, name); }}>+ Add</button>
                    </div>
                  </div>

                  <div style={styles.cardGrid}>
                    {cat.items.map((it, ii) => (
                      <div key={ii} style={{...styles.itemCard, opacity: it.packed ? 0.5 : 1}}>
                        <div style={styles.itemTop}>
                          <div style={styles.itemIcon}>{itemEmoji(it.text)}</div>
                          <div style={styles.itemText}>{it.text}</div>
                          <div style={{flex:1}} />
                          <button style={styles.packBtn} onClick={() => togglePacked(ci, ii)}>{it.packed ? 'Packed' : 'Pack'}</button>
                        </div>

                        <div style={styles.itemActions}>
                          <button style={styles.deleteBtn} onClick={() => removeItem(ci, ii)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Save + View buttons */}
              <div style={{display: 'flex', gap: 12, marginTop: 18, alignItems:'center'}}>
                <button style={styles.primaryBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '💾 Save List'}</button>
                <button style={styles.ghostBtn} onClick={() => navigate('/saved-packing-lists')}>📂 View Saved Lists</button>
                <div style={{marginLeft: 'auto'}}>
                  <div style={{fontSize: 14, color: '#374151'}}>{progress}% complete</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Styles (JS object) ---
// --- Styles (JS object) ---
const styles = {
  // new outer wrapper makes the whole React component scroll vertically when content overflows
  pageScroll: {
    height: '100vh',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
    paddingTop: 0,
    background: '#f7fafc'
  },
  page: { 
    fontFamily: 'Inter, Roboto, system-ui, -apple-system, sans-serif', 
    background: 'transparent',
    minHeight: '100%',
    paddingBottom: 40
  },
  topBar: { padding: 20, display: 'flex', justifyContent: 'center' },
  moodCard: { width: '92%', maxWidth: 1100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg,#ffffff,#fffaf0)', padding: 16, borderRadius: 12, boxShadow: '0 4px 18px rgba(15,23,42,0.06)' },
  moodLeft: { display:'flex', flexDirection: 'column' },
  moodRight: { display:'flex', gap: 8, alignItems: 'center' },
  tripTitle: { fontSize: 20, fontWeight: 700 },
  tripMeta: { color: '#6b7280', marginTop: 6, display:'flex', gap: 8, fontSize: 13 },
  suggestText: { marginTop: 10, color: '#374151' },
  smallBtn: { padding: '8px 10px', borderRadius: 8, border: 'none', background: '#eef2ff', cursor: 'pointer' },

  container: { 
    width: '92%', 
    maxWidth: 1100, 
    margin: '20px auto', 
    display: 'grid', 
    gridTemplateColumns: '1fr 1.2fr', 
    gap: 20 
  },
  leftColumn: { display: 'flex', flexDirection: 'column', gap: 14 },

  // 🧳 Suitcase scrollable
  suitcaseWrap: { 
    background: 'linear-gradient(180deg,#fff,#f8fafc)', 
    borderRadius: 12, 
    padding: 14, 
    boxShadow: '0 6px 20px rgba(2,6,23,0.06)',
    maxHeight: '65vh', 
    overflowY: 'auto'
  },
  suitcaseHeader: { fontWeight: 800, fontSize: 18, marginBottom: 8 },
  suitcaseInner: { display: 'flex', gap: 12 },
  suitSection: { flex:1, background: '#fff', borderRadius: 10, padding: 10, minHeight: 140, border: '1px solid #eef2f7' },
  sectionTitle: { fontWeight: 700, fontSize: 14, marginBottom: 8 },
  sectionList: { display: 'flex', flexDirection: 'column', gap: 8 },
  suitItem: { display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'linear-gradient(90deg,#ffffff,#fbfbfb)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.02)' },
  suitcaseFooter: { marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  progressWrap: { width: '100%' },
  progressText: { fontSize: 13, color: '#374151', marginBottom: 6 },
  progressBar: { background: '#e6eef7', height: 10, borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#34d399,#06b6d4)', borderRadius: 100, transition: 'width 350ms ease' },

  // 📋 Form scrollable
  formCard: { 
    background: '#fff', 
    padding: 12, 
    borderRadius: 8, 
    boxShadow: '0 6px 18px rgba(2,6,23,0.04)',
    maxHeight: '65vh',
    overflowY: 'auto'
  },
  row: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 },
  label: { fontSize: 13, color: '#374151', fontWeight: 600 },
  input: { padding: 10, borderRadius: 8, border: '1px solid #e6eef7', fontSize: 14 },
  primaryBtn: { background: '#ff6b35', color: '#fff', padding: '10px 14px', border: 'none', borderRadius: 10, cursor: 'pointer' },
  ghostBtn: { background: '#fff', color: '#374151', padding: '10px 12px', border: '1px solid #eef2f7', borderRadius: 10, cursor: 'pointer' },

  rightColumn: { display: 'flex', flexDirection: 'column' },
  tabBar: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  tab: { padding: '8px 12px', background: '#fff', borderRadius: 999, border: '1px solid #eef2f7' },
  tabEmpty: { color: '#9ca3af' },

  // ✅ Categories / Generated List scrollable
  gridArea: { 
    background: '#fff', 
    padding: 14, 
    borderRadius: 10, 
    minHeight: 400, 
    maxHeight: '65vh', 
    overflowY: 'auto', 
    boxShadow: '0 6px 18px rgba(2,6,23,0.04)' 
  },

  placeholder: { color: '#9ca3af', padding: 40, textAlign: 'center' },
  categoryBlock: { marginBottom: 18 },
  categoryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 },
  itemCard: { background: '#f8fafc', borderRadius: 10, padding: 12, boxShadow: '0 2px 8px rgba(2,6,23,0.04)', display: 'flex', flexDirection: 'column' },
  itemTop: { display: 'flex', alignItems: 'center', gap: 10 },
  itemIcon: { fontSize: 22 },
  itemText: { fontWeight: 700 },
  packBtn: { padding: '6px 10px', borderRadius: 8, border: 'none', background: '#06b6d4', color: '#fff', cursor: 'pointer' },
  itemActions: { display: 'flex', gap: 8, marginTop: 10 },
  deleteBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' },
  smallIconBtn: { background: '#fff', border: '1px dashed #e6eef7', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }
};
