// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./Homepage";
import Login from "./Login";
import Signup from "./Signup";
import PlanTrip from "./PlanTrip";
import MyTrips from "./MyTrips";
import FindHotel from "./FindHotel";
import TodoList from "./TodoList";
import PackMyBag from "./PackMyBag";
import SavedPackingLists from "./SavedPackingLists";
import SavedHotelsPage from "./SavedHotelsPage"; 
import BudgetPlanner from "./BudgetPlanner";   // ✅ Import BudgetPlanner
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { SavedListProvider } from "./SavedListContext";  
import "./Auth.css";
import "./Homepage.css";
import Saved from "./Saved";
import PackMyBagScrollable from "./PackMyBagScrollable";
import Discover from "./Discover";

function App() {
  const [user, setUser] = useState(null);
  const [authPopupVisible, setAuthPopupVisible] = useState(false);
  const [showLogin, setShowLogin] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setAuthPopupVisible(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const openAuthPopup = () => {
    setAuthPopupVisible(true);
  };

  const closeAuthPopup = () => {
    setAuthPopupVisible(false);
  };

  return (
    <Router>
      <SavedListProvider>
        <Routes>
          {/* Homepage */}
          <Route
            path="/"
            element={
              <Homepage
                user={user}
                onProfileClick={openAuthPopup}
                onLogout={handleLogout}
              />
            }
          />

          {/* PlanTrip Page */}
          <Route path="/plan-trip" element={<PlanTrip />} />

          {/* MyTrips Page */}
          <Route path="/my-trips" element={<MyTrips />} />

          {/* FindHotel Page */}
          <Route path="/book-hotel" element={<FindHotel />} />

          {/* Saved Hotels Page */}
          <Route path="/saved-hotels" element={<SavedHotelsPage />} />

          {/* TodoList Page */}
          <Route path="/todo" element={<TodoList />} />

          {/* PackMyBag Page */}
          <Route path="/pack-my-bag" element={<PackMyBag />} />

          {/* Saved Packing Lists Page */}
          <Route path="/saved-packing-lists" element={<SavedPackingLists />} />

          {/* ✅ Budget Planner Page */}
          <Route path="/budget-planner" element={<BudgetPlanner />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/packmybag-scrollable" element={<PackMyBagScrollable />} />
          
        </Routes>

        {/* Auth Popup */}
        {authPopupVisible && (
          <div className="auth-popup">
            <div className="auth-card">
              <button className="auth-close-btn" onClick={closeAuthPopup}>
                ✖
              </button>
              {showLogin ? (
                <Login
                  toggleForm={() => setShowLogin(false)}
                  onLogin={handleLogin}
                />
              ) : (
                <Signup
                  toggleForm={() => setShowLogin(true)}
                  onSignup={handleLogin}
                />
              )}
            </div>
          </div>
        )}
      </SavedListProvider>
    </Router>
  );
}

export default App;
