// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAsKAbgKf5xx7dmEVX82yvleRUW6_n1JEs",
  authDomain: "scenary-4f022.firebaseapp.com",
  projectId: "scenary-4f022",
  storageBucket: "scenary-4f022.firebasestorage.app",
  messagingSenderId: "1053511640232",
  appId: "1:1053511640232:web:c9919ebc339ca0f03a0e9d",
  measurementId: "G-9BL059HZEH",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
