import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Shumei-2025 Firebase Configuration
export const shumeiFirebaseConfig = {
  apiKey: "AIzaSyBbzTRUs27I0ksU4RtTP6Eezuh09rSp1Zg",
  authDomain: "shumei-2025.firebaseapp.com",
  databaseURL: "https://shumei-2025-default-rtdb.firebaseio.com",
  projectId: "shumei-2025",
  storageBucket: "shumei-2025.firebasestorage.app",
  messagingSenderId: "540567757935",
  appId: "1:540567757935:web:5940555836860d1679599a",
};

// Gantt-Craft-2026 Firebase Configuration (for ganttcraft_ projects)
export const ganttFirebaseConfig = {
  apiKey: "AIzaSyDhgmR4eEp7RtNPL2cLw9rgAP605xVttb0",
  authDomain: "gantt-craft-2026.firebaseapp.com",
  projectId: "gantt-craft-2026",
  storageBucket: "gantt-craft-2026.firebasestorage.app",
  messagingSenderId: "360443536934",
  appId: "1:360443536934:web:937d149a6ca1d8dc5f68e7",
};

// Safe initialization helper
const existingApp = getApps().find((a) => a.name === "shumei");
export const shumeiApp = existingApp || initializeApp(shumeiFirebaseConfig, "shumei");

export const shumeiDb = getFirestore(shumeiApp);
export const shumeiAuth = getAuth(shumeiApp);
export const shumeiGoogleProvider = new GoogleAuthProvider();
shumeiGoogleProvider.setCustomParameters({
  prompt: "select_account",
});

const existingGanttApp = getApps().find((a) => a.name === "gantt");
export const ganttApp = existingGanttApp || initializeApp(ganttFirebaseConfig, "gantt");
export const ganttDb = getFirestore(ganttApp);
