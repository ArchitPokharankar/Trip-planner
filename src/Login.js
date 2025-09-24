import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

function Login({ toggleForm, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch full profile from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const profileData = userDoc.exists() ? userDoc.data() : { displayName: user.email };

      // Merge Firebase auth info with Firestore profile
      const fullUser = { uid: user.uid, email: user.email, displayName: profileData.name || user.email };
      onLogin(fullUser); // Update Homepage with name
    } catch (err) {
      if (err.code === "auth/user-not-found") setError("No user found with this email.");
      else if (err.code === "auth/wrong-password") setError("Incorrect password.");
      else setError("Login failed. Please try again.");
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
      <p>
        Don't have an account?{" "}
        <span className="switch-link" onClick={toggleForm}>
          Sign Up
        </span>
      </p>
    </div>
  );
}

export default Login;
