import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
// @ts-ignore
import { mcqData } from "../src/questions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

// Import firebase config
const firebaseConfigPath = path.join(rootDir, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

// Initialize Admin SDK
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
} catch (e) {
  console.error("Firebase Admin init error:", e);
}

const getDb = () => {
  try {
    return getFirestore(firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    return getFirestore();
  }
};

const db = getDb();
const app = express();

import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  collection as clientCollection, 
  getDocs as clientGetDocs,
  doc as clientDoc,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  getDoc as clientGetDoc,
  writeBatch as clientWriteBatch
} from "firebase/firestore";

// Initialize Client SDK on server as workaround for gRPC/Admin perm issues
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

app.use(express.json());

// API to get all questions
app.get("/api/questions", async (req, res) => {
  try {
    const snapshot = await clientGetDocs(clientCollection(clientDb, "questions"));
    const questions = snapshot.docs.map(doc => doc.data());
    questions.sort((a: any, b: any) => a.id - b.id);
    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to check user status
app.get("/api/user-status", async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "Email is required" });
  
  const userEmail = email.toLowerCase().trim();
  try {
    const userDoc = await clientGetDoc(clientDoc(clientDb, "users", userEmail));
    if (userDoc.exists()) {
      res.json(userDoc.data());
    } else {
      res.json({ email: userEmail, status: "not_subscribed" });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to update status
app.post("/api/admin/update-status", async (req, res) => {
  const { email, status } = req.body;
  if (!email || !status) return res.status(400).json({ error: "Email and status are required" });
  
  const userEmail = email.toLowerCase().trim();
  try {
    await clientSetDoc(clientDoc(clientDb, "users", userEmail), { email: userEmail, status }, { merge: true });
    res.json({ message: "Success", user: { email: userEmail, status } });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to delete user
app.delete("/api/admin/users/:email", async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    await clientDeleteDoc(clientDoc(clientDb, "users", email));
    res.json({ message: "User deleted" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all users
app.get("/api/admin/users", async (req, res) => {
  try {
    const snapshot = await clientGetDocs(clientCollection(clientDb, "users"));
    const users = snapshot.docs.map(doc => doc.data());
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

async function startServer() {
  const PORT = 3000;
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
