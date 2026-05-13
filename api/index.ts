import express from "express";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  query,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { mcqData } from "../src/questions";

const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-4fc9d",
  appId: "1:809712558883:web:c08f0b98980b3e6fa1e296",
  apiKey: "AIzaSyC-E3iPcVw8hCJ8r0tABGQEWf6sVI0AAZM",
  authDomain: "ai-studio-applet-webapp-4fc9d.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-666e319f-be05-454b-9892-4be6e24bdca1",
  storageBucket: "ai-studio-applet-webapp-4fc9d.firebasestorage.app",
  messagingSenderId: "809712558883",
  measurementId: "",
};

// Singleton Firebase initialization (survives warm starts)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const serverApp = express();
serverApp.use(express.json());

// API to get all questions
serverApp.get("/api/questions", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "questions"));
    const questions = snapshot.docs.map((d) => d.data());
    questions.sort((a: any, b: any) => a.id - b.id);
    res.json(questions);
  } catch (error: any) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to check user status
serverApp.get("/api/user-status", async (req, res) => {
  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const userEmail = email.toLowerCase().trim();
  try {
    const userDoc = await getDoc(doc(db, "users", userEmail));
    if (userDoc.exists()) {
      res.json(userDoc.data());
    } else {
      res.json({ email: userEmail, status: "not_subscribed" });
    }
  } catch (error: any) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to update status
serverApp.post("/api/admin/update-status", async (req, res) => {
  const { email, status } = req.body;
  if (!email || !status) {
    return res.status(400).json({ error: "Email and status are required" });
  }

  const userEmail = email.toLowerCase().trim();
  try {
    await setDoc(doc(db, "users", userEmail), { email: userEmail, status }, { merge: true });
    res.json({ message: "Success", user: { email: userEmail, status } });
  } catch (error: any) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to delete user
serverApp.delete("/api/admin/users/:email", async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    await deleteDoc(doc(db, "users", email));
    res.json({ message: "User deleted" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all users
serverApp.get("/api/admin/users", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    const users = snapshot.docs.map((d) => d.data());
    res.json(users);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to sync questions (on-demand)
serverApp.post("/api/admin/sync-questions", async (req, res) => {
  try {
    const qCol = collection(db, "questions");
    const remoteCountSnapshot = await getCountFromServer(qCol);
    const remoteCount = remoteCountSnapshot.data().count;

    if (remoteCount >= mcqData.length) {
      return res.json({ message: "Already synced", local: mcqData.length, remote: remoteCount });
    }

    for (let i = 0; i < mcqData.length; i += 500) {
      const chunk = mcqData.slice(i, i + 500);
      const batch = writeBatch(db);
      chunk.forEach((q) => {
        const docRef = doc(db, "questions", q.id.toString());
        batch.set(docRef, q, { merge: true });
      });
      await batch.commit();
    }

    res.json({ message: "Sync completed", count: mcqData.length });
  } catch (error: any) {
    console.error("Error syncing questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default serverApp;
