// src/BudgetPlanner.js
import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import Papa from "papaparse"; // robust CSV parsing
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import "./BudgetPlanner.css";

/*
  Full, feature-complete BudgetPlanner component.

  - CSV: place trip_packages.csv in public/ with headers:
    PackageName,Destination,RequiredBudget,Itinerary,ImageURL
    (Itinerary may contain commas/newlines; PapaParse will handle it)

  - Firestore layout used by this component:
    users/{uid}/budgetPlanner/data  -> holds live working data (planCategories, compareEntries, overallBudget, userBudgetPackages, filteredPackages)
    users/{uid}/budgetPlanner/saved -> holds savedPackages and savedPlan (for Saved.js page)

  - Features included:
    * Plan tab: add/edit/delete categories, save plan to saved doc
    * Compare tab: add/edit/delete budget vs actual entries, charts
    * Packages tab: parse CSV via PapaParse, show large package cards with image+itinerary, save package to saved doc
    * All important state persists to Firestore (setDoc merge)
*/

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#FF4444",
  "#AA66CC",
  "#2E8B57",
  "#6A5ACD",
  "#FF69B4",
];

const FALLBACK_IMAGE = (keyword = "travel") => `https://source.unsplash.com/800x480/?${encodeURIComponent(keyword)}`;

function uidSafe() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function BudgetPlanner() {
  // Tabs
  const [activeTab, setActiveTab] = useState("plan");

  // PLAN state
  const [planCategories, setPlanCategories] = useState([]); // {id, name, allocatedBudget, categoryTag}
  const [newPlanCatName, setNewPlanCatName] = useState("");
  const [newPlanCatBudget, setNewPlanCatBudget] = useState("");
  const [newPlanCatTag, setNewPlanCatTag] = useState("");

  // COMPARE state
  const [compareEntries, setCompareEntries] = useState([]); // {id, category, budget, actual}
  const [cmpCategory, setCmpCategory] = useState("");
  const [cmpBudget, setCmpBudget] = useState("");
  const [cmpActual, setCmpActual] = useState("");
  const [overallBudget, setOverallBudget] = useState("");

  // PACKAGES
  const [packagesCsv, setPackagesCsv] = useState([]); // raw from CSV
  const [userBudgetPackages, setUserBudgetPackages] = useState("");
  const [filteredPackages, setFilteredPackages] = useState([]); // after budget filter
  const [csvLoading, setCsvLoading] = useState(false);

  // Misc
  const [loadingSave, setLoadingSave] = useState(false);
  const mountedRef = useRef(true);

  // Firestore refs
  const getUserDataDocRef = () => {
    if (!auth.currentUser) return null;
    return doc(db, "users", auth.currentUser.uid, "budgetPlanner", "data");
  };

  const getUserSavedDocRef = () => {
    if (!auth.currentUser) return null;
    return doc(db, "users", auth.currentUser.uid, "budgetPlanner", "saved");
  };

  // ------------------- Load initial data -------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const dref = getUserDataDocRef();
    if (!dref) return;

    // load once
    (async () => {
      try {
        const snap = await getDoc(dref);
        if (snap.exists()) {
          const data = snap.data();
          if (data.planCategories) setPlanCategories(data.planCategories);
          if (data.compareEntries) setCompareEntries(data.compareEntries);
          if (data.overallBudget) setOverallBudget(data.overallBudget);
          if (data.userBudgetPackages) setUserBudgetPackages(data.userBudgetPackages);
          if (data.filteredPackages) setFilteredPackages(data.filteredPackages);
        }
      } catch (err) {
        console.error("Error loading budgetPlanner data:", err);
      }
    })();
  }, [auth.currentUser]);

  // ------------------- Persist helper -------------------
  const saveAllToFirestore = async (overrides = {}) => {
    if (!auth.currentUser) return;
    const dref = getUserDataDocRef();
    if (!dref) return;
    const payload = {
      planCategories,
      compareEntries,
      overallBudget,
      userBudgetPackages,
      filteredPackages,
      ...overrides,
    };
    try {
      await setDoc(dref, payload, { merge: true });
    } catch (err) {
      console.error("Error saving budgetPlanner data:", err);
    }
  };

  // Save saved-doc separate (for Saved.js page)
  const saveToSavedDoc = async (overrides = {}) => {
    if (!auth.currentUser) return;
    const sref = getUserSavedDocRef();
    if (!sref) return;
    try {
      await setDoc(sref, overrides, { merge: true });
    } catch (err) {
      console.error("Error saving to saved doc:", err);
    }
  };

  // ------------------- PLAN functions -------------------
  const addPlanCategory = () => {
    const name = (newPlanCatName || "").trim();
    const alloc = parseFloat(newPlanCatBudget);
    if (!name) return alert("Enter category name");
    if (isNaN(alloc) || alloc < 0) return alert("Enter valid allocation");
    const id = `plan_${uidSafe()}`;
    const newItem = { id, name, allocatedBudget: alloc, tag: newPlanCatTag || "" };
    const updated = [...planCategories, newItem];
    setPlanCategories(updated);
    setNewPlanCatName("");
    setNewPlanCatBudget("");
    setNewPlanCatTag("");
    saveAllToFirestore({ planCategories: updated });
  };

  const editPlanCategory = (id, updates) => {
    const updated = planCategories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setPlanCategories(updated);
    saveAllToFirestore({ planCategories: updated });
  };

  const deletePlanCategory = (id) => {
    if (!window.confirm("Delete category?")) return;
    const updated = planCategories.filter((c) => c.id !== id);
    setPlanCategories(updated);
    saveAllToFirestore({ planCategories: updated });
  };

  const savePlanToSaved = async () => {
    setLoadingSave(true);
    try {
      await saveToSavedDoc({ savedPlan: { savedAt: new Date().toISOString(), planCategories } });
      alert("Plan saved to Saved.js data successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to save plan. See console.");
    } finally {
      setLoadingSave(false);
    }
  };

  // ------------------- COMPARE functions -------------------
  const addCompareEntry = () => {
    const category = (cmpCategory || "").trim() || `Category ${compareEntries.length + 1}`;
    const b = parseFloat(cmpBudget);
    const a = parseFloat(cmpActual);
    if (isNaN(b) || isNaN(a)) return alert("Enter valid numbers for budget and actual");
    const entry = { id: `cmp_${uidSafe()}`, category, budget: b, actual: a };
    const updated = [...compareEntries, entry];
    setCompareEntries(updated);
    setCmpCategory("");
    setCmpBudget("");
    setCmpActual("");
    saveAllToFirestore({ compareEntries: updated });
  };

  const editCompareEntry = (id, updates) => {
    const updated = compareEntries.map((e) => (e.id === id ? { ...e, ...updates } : e));
    setCompareEntries(updated);
    saveAllToFirestore({ compareEntries: updated });
  };

  const deleteCompareEntry = (id) => {
    if (!window.confirm("Delete this compare entry?")) return;
    const updated = compareEntries.filter((e) => e.id !== id);
    setCompareEntries(updated);
    saveAllToFirestore({ compareEntries: updated });
  };

  const saveOverallBudget = (val) => {
    setOverallBudget(val);
    saveAllToFirestore({ overallBudget: val });
  };

  // ------------------- CSV parse (PapaParse) -------------------
  useEffect(() => {
    (async () => {
      setCsvLoading(true);
      try {
        const res = await fetch("/trip_packages.csv");
        if (!res.ok) {
          console.warn("Could not fetch /trip_packages.csv — make sure file exists in public/");
          setCsvLoading(false);
          return;
        }
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        // parsed.data is array of objects keyed by header names
        const data = parsed.data.map((obj, i) => {
          // Normalize header variants (trim keys)
          const normalized = {};
          Object.keys(obj).forEach((k) => {
            const nk = k.trim();
            normalized[nk] = obj[k];
          });
          // ensure keys exist
          normalized.PackageName = normalized.PackageName || normalized.packageName || normalized.name || `Package ${i + 1}`;
          normalized.Destination = normalized.Destination || normalized.destination || "";
          normalized.Itinerary = normalized.Itinerary || normalized.itinerary || "";
          normalized.ImageURL = normalized.ImageURL || normalized.imageURL || normalized.image || "";
          // parse RequiredBudget
          const raw = normalized.RequiredBudget || normalized.requiredBudget || normalized.budget || "0";
          const n = parseFloat((raw + "").replace(/[^0-9.-]/g, ""));
          normalized.RequiredBudget = isNaN(n) ? 0 : n;
          return normalized;
        });
        setPackagesCsv(data);
      } catch (err) {
        console.error("Error parsing CSV:", err);
      } finally {
        if (mountedRef.current) setCsvLoading(false);
      }
    })();
  }, []);

  // ------------------- Filter packages by budget -------------------
  useEffect(() => {
    if (!userBudgetPackages || packagesCsv.length === 0) {
      setFilteredPackages([]);
      return;
    }
    const budgetNum = parseFloat(userBudgetPackages);
    if (isNaN(budgetNum)) {
      setFilteredPackages([]);
      return;
    }
    const filtered = packagesCsv.filter((p) => (p.RequiredBudget || 0) <= budgetNum);
    setFilteredPackages(filtered);
    saveAllToFirestore({ userBudgetPackages, filteredPackages: filtered });
  }, [userBudgetPackages, packagesCsv]);

  // ------------------- Save single package to saved doc list -------------------
  const savePackage = async (p) => {
    // p is package object
    const current = filteredPackages || [];
    // Add chosenAt and id if not present
    const toSave = { ...p, chosenAt: new Date().toISOString(), savedId: p.savedId || `pkg_${uidSafe()}` };
    const exists = current.find((fp) => fp.PackageName === p.PackageName && fp.Destination === p.Destination);
    const newList = exists ? current : [...current, toSave];
    setFilteredPackages(newList);
    saveAllToFirestore({ filteredPackages: newList });
    // also write only savedPackages to saved doc for Saved.js
    try {
      await saveToSavedDoc({ savedPackages: newList });
      alert(`Saved ${p.PackageName} ✔`);
    } catch (err) {
      console.error(err);
      alert("Failed to save package to saved doc.");
    }
  };

  // ------------------- Utility UI helpers -------------------
  const totalAllocated = planCategories.reduce((s, c) => s + (parseFloat(c.allocatedBudget) || 0), 0);
  const totalSpent = compareEntries.reduce((s, e) => s + (parseFloat(e.actual) || 0), 0);

  // chart data
  const pieData = compareEntries.map((e) => ({ name: e.category, value: e.actual })).filter((it) => it.value > 0);
  const barData = compareEntries.map((e) => ({ category: e.category, Budget: e.budget, Actual: e.actual }));

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
    // default labels handled by Recharts label prop - keep simple
    return null;
  };

  // ------------------- Render -------------------
  return (
    <div className="budget-container" style={{ padding: 18 }}>
      <h1 style={{ margin: 0 }}>💸 Trip Budget Planner</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("plan")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: activeTab === "plan" ? "#4CAF50" : "#FF6B35", color: "white" }}>Plan</button>
        <button onClick={() => setActiveTab("compare")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: activeTab === "compare" ? "#4CAF50" : "#FF6B35", color: "white" }}>Compare</button>
        <button onClick={() => setActiveTab("packages")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: activeTab === "packages" ? "#4CAF50" : "#FF6B35", color: "white" }}>Packages</button>
      </div>

      {/* -------- PLAN TAB -------- */}
      {activeTab === "plan" && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>🧾 Plan — categories & allocation</h2>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input placeholder="Category name (e.g., Food)" value={newPlanCatName} onChange={(e) => setNewPlanCatName(e.target.value)} style={{ padding: 8 }} />
            <input placeholder="Allocated budget (₹)" value={newPlanCatBudget} onChange={(e) => setNewPlanCatBudget(e.target.value)} style={{ padding: 8 }} />
            <input placeholder="Category tag (optional)" value={newPlanCatTag} onChange={(e) => setNewPlanCatTag(e.target.value)} style={{ padding: 8 }} />
            <button onClick={addPlanCategory} style={{ padding: "8px 12px", background: "#00C49F", color: "white", border: "none", borderRadius: 6 }}>➕ Add</button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {planCategories.length === 0 ? (
              <div style={{ color: "#666" }}>No categories yet — add one above.</div>
            ) : (
              planCategories.map((c) => (
                <div key={c.id} style={{ padding: 12, borderRadius: 8, border: "1px solid #e9e9e9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.name} {c.tag ? <span style={{ color: "#888", fontWeight: 500, marginLeft: 8 }}>• {c.tag}</span> : null}</div>
                    <div style={{ color: "#666", marginTop: 6 }}>Allocated: ₹
                      <input type="number" value={c.allocatedBudget} onChange={(e) => editPlanCategory(c.id, { allocatedBudget: parseFloat(e.target.value) || 0 })} style={{ width: 120, marginLeft: 8, padding: 6 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { const newName = prompt("Edit name", c.name); if (newName) editPlanCategory(c.id, { name: newName }); }} style={{ padding: "6px 10px" }}>✏️</button>
                    <button onClick={() => deletePlanCategory(c.id)} style={{ padding: "6px 10px", background: "#ff4444", color: "white", border: "none", borderRadius: 6 }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>Total Allocated: ₹{totalAllocated}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(planCategories)); alert('Copied plan JSON to clipboard'); }} style={{ padding: "8px 12px" }}>Copy JSON</button>
              <button onClick={savePlanToSaved} style={{ padding: "8px 12px", background: "#0077cc", color: "white", border: "none", borderRadius: 6 }}>{loadingSave ? 'Saving…' : '💾 Save Budget Plan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* -------- COMPARE TAB -------- */}
      {activeTab === "compare" && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>📊 Compare — Budget vs Actual</h2>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input placeholder="Category" value={cmpCategory} onChange={(e) => setCmpCategory(e.target.value)} style={{ padding: 8 }} />
            <input placeholder="Budget (₹)" value={cmpBudget} onChange={(e) => setCmpBudget(e.target.value)} style={{ padding: 8 }} />
            <input placeholder="Actual (₹)" value={cmpActual} onChange={(e) => setCmpActual(e.target.value)} style={{ padding: 8 }} />
            <button onClick={addCompareEntry} style={{ padding: "8px 12px", background: "#00C49F", color: "white", border: "none", borderRadius: 6 }}>➕ Add</button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Overall Trip Budget: </label>
            <input value={overallBudget} onChange={(e) => saveOverallBudget(e.target.value)} style={{ padding: 8, marginLeft: 8 }} />
            <span style={{ marginLeft: 12, color: '#555' }}>Planned total: ₹{compareEntries.reduce((s, e) => s + (e.budget || 0), 0)} • Spent total: ₹{totalSpent}</span>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {compareEntries.length === 0 ? (
              <div style={{ color: '#666' }}>No compare entries yet.</div>
            ) : (
              compareEntries.map((e) => (
                <div key={e.id} style={{ padding: 10, borderRadius: 8, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{e.category}</strong>
                    <div style={{ color: '#666' }}>Budget: ₹{e.budget} • Actual: ₹{e.actual}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { const nb = prompt('Edit budget', `${e.budget}`); const na = prompt('Edit actual', `${e.actual}`); if (nb !== null && na !== null) editCompareEntry(e.id, { budget: parseFloat(nb) || 0, actual: parseFloat(na) || 0 }); }} style={{ padding: '6px 10px' }}>✏️</button>
                    <button onClick={() => deleteCompareEntry(e.id)} style={{ padding: '6px 10px', background: '#ff4444', color: 'white', border: 'none', borderRadius: 6 }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <h4 style={{ marginTop: 0 }}>Actual Spend by Category</h4>
              {pieData.length === 0 ? <div style={{ color: '#777' }}>No data</div> : (
                <PieChart width={320} height={260}>
                  <Pie data={pieData} cx={160} cy={120} outerRadius={90} dataKey='value' label>
                    {pieData.map((entry, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value}`} />
                </PieChart>
              )}
            </div>

            <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <h4 style={{ marginTop: 0 }}>Budget vs Actual</h4>
              {barData.length === 0 ? <div style={{ color: '#777' }}>No data</div> : (
                <BarChart width={520} height={260} data={barData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='category' />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Legend />
                  <Bar dataKey='Budget' fill='#00C49F' />
                  <Bar dataKey='Actual' fill='#FF4444' />
                </BarChart>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------- PACKAGES TAB -------- */}
      {activeTab === 'packages' && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>🎁 Packages — suggestions</h2>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input type='number' placeholder='Enter your budget (₹)' value={userBudgetPackages} onChange={(e) => setUserBudgetPackages(e.target.value)} style={{ padding: 8 }} />
            <button onClick={() => { const budgetNum = parseFloat(userBudgetPackages); if (isNaN(budgetNum)) return alert('Enter a valid budget'); const filtered = packagesCsv.filter((p) => (p.RequiredBudget || 0) <= budgetNum); setFilteredPackages(filtered); saveAllToFirestore({ userBudgetPackages, filteredPackages: filtered }); }} style={{ padding: '8px 12px', background: '#00C49F', color: 'white', border: 'none', borderRadius: 6 }}>🔍 Suggest</button>
            <button onClick={() => alert(`Loaded ${packagesCsv.length} packages (from public/trip_packages.csv)`)} style={{ padding: '8px 12px' }}>ℹ️ CSV Info</button>
            <div style={{ marginLeft: 'auto', color: '#666' }}>{csvLoading ? 'Loading CSV…' : `${packagesCsv.length} packages available`}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredPackages.length === 0 ? (
              <div style={{ color: '#777' }}>No suggestions. Increase budget or check CSV.</div>
            ) : (
              filteredPackages.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: '1px solid #eee', alignItems: 'flex-start', boxShadow: '0 1px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: 300, flex: '0 0 300px' }}>
                    <img src={(p.ImageURL && p.ImageURL.trim()) || FALLBACK_IMAGE(p.Destination || p.PackageName || 'travel')} alt={p.PackageName} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8 }} onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE(p.Destination || 'travel'); }} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px 0' }}>{p.PackageName || 'Unnamed Package'}</h3>
                        <div style={{ color: '#666' }}>{p.Destination || 'Unknown Destination'}</div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>₹{p.RequiredBudget}</div>
                        <div style={{ marginTop: 8 }}>
                          <button onClick={() => savePackage(p)} style={{ padding: '8px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 6 }}>⭐ Save</button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <strong>Planned Itinerary</strong>
                      <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 6, color: '#333' }}>
                        {p.Itinerary && p.Itinerary.trim() ? p.Itinerary : <em>No itinerary provided.</em>}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <input placeholder='Add local tag/note' style={{ padding: 8, flex: 1 }} defaultValue={p.localNote || ''} onBlur={(e) => { const note = e.target.value.trim(); if (!note) return; const newList = filteredPackages.map((fp, i) => i === idx ? { ...fp, localNote: note } : fp); setFilteredPackages(newList); saveAllToFirestore({ filteredPackages: newList }); saveToSavedDoc({ savedPackages: newList }); }} />
                      <button onClick={() => { // quick add to plan
                        const catName = p.PackageName || `${p.Destination} package`;
                        const id = `plan_${uidSafe()}`;
                        const alloc = Number(p.RequiredBudget) || 0;
                        const updated = [...planCategories, { id, name: catName, allocatedBudget: alloc, tag: 'Package' }];
                        setPlanCategories(updated);
                        saveAllToFirestore({ planCategories: updated });
                        alert(`${catName} added to Plan.`);
                      }} style={{ padding: '8px 12px', background: '#0077cc', color: 'white', border: 'none', borderRadius: 6 }}>➕ Add to Plan</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default BudgetPlanner;
