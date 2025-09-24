// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ✅ import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyCx8cVjqMN1Cl-UT-PNM9KMA-az9J2j3TY",
  authDomain: "trip-planner-76223.firebaseapp.com",
  projectId: "trip-planner-76223",
  storageBucket: "trip-planner-76223.firebasestorage.app",
  messagingSenderId: "519730750090",
  appId: "1:519730750090:web:11e9e08a893fb844ea4373",
  measurementId: "G-S7PK83Z2V2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // ✅ export db
