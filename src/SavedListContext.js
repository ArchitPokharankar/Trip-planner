// src/SavedListContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const SavedListContext = createContext();

export const SavedListProvider = ({ children }) => {
  const [savedHotels, setSavedHotels] = useState([]);

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // If no user, clear saved hotels
      if (!user) {
        setSavedHotels([]);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        return;
      }

      // Subscribe to this user's saved hotels
      const colRef = collection(db, "users", user.uid, "savedHotels");
      unsubscribeSnapshot = onSnapshot(colRef, (snapshot) => {
        const hotels = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSavedHotels(hotels);
      });
    });

    // Cleanup both listeners
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubscribeAuth();
    };
  }, []);

  // Add to Firestore
  const addToSaved = async (hotel) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to save hotels");
      return;
    }
    const colRef = collection(db, "users", user.uid, "savedHotels");
    await addDoc(colRef, hotel);
  };

  // Remove from Firestore
  const removeFromSaved = async (hotelId) => {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, "users", user.uid, "savedHotels", hotelId);
    await deleteDoc(docRef);
  };

  return (
    <SavedListContext.Provider
      value={{ savedHotels, addToSaved, removeFromSaved }}
    >
      {children}
    </SavedListContext.Provider>
  );
};

export const useSavedList = () => useContext(SavedListContext);
