import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { mcqData } from "./src/questions.ts";

// Import firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

// Initialize Admin SDK
try {
  // Try initializing with the minimum config - auto-detection is usually better in Cloud Run
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
} catch (e) {
  console.error("Firebase Admin init error:", e);
}

// In some versions of firebase-admin, passing the databaseId to getFirestore is the way
// In others, it might be admin.firestore(databaseId)
const getDb = () => {
  try {
    return getFirestore(firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.error("Error getting firestore with databaseId, falling back to default:", e);
    return getFirestore();
  }
};

const db = getDb();
console.log("Firestore ready.");

interface User {
  email: string;
  status: "subscribed" | "not_subscribed" | "admin";
}

// Initial default users
const defaultUsers: Record<string, User> = {
  "admin@example.com": { email: "admin@example.com", status: "admin" },
  "user@example.com": { email: "user@example.com", status: "not_subscribed" },
  "kitpitbaisa@gmail.com": { email: "kitpitbaisa@gmail.com", status: "admin" },
};

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

async function ensureDefaultUsers() {
  try {
    const querySnapshot = await clientGetDocs(clientCollection(clientDb, "users"));
    if (querySnapshot.empty) {
      console.log("Initializing database with default users (Client SDK)...");
      const batch = clientWriteBatch(clientDb);
      for (const [email, userData] of Object.entries(defaultUsers)) {
        const docRef = clientDoc(clientDb, "users", email);
        batch.set(docRef, userData);
      }
      await batch.commit();
      console.log("Default users initialized.");
    }
  } catch (error) {
    console.error("Error initializing default users (Client SDK):", error);
  }
}

async function migrateQuestions() {
  try {
    const qCol = clientCollection(clientDb, "questions");
    const snapshot = await clientGetDocs(qCol);
    
    if (snapshot.size < 10) {
      console.log(`Starting migration of ${mcqData.length} questions to Firestore (Client SDK)...`);
      const batchSize = 100; // Client SDK limit
      for (let i = 0; i < mcqData.length; i += batchSize) {
        const batch = clientWriteBatch(clientDb);
        const chunk = mcqData.slice(i, i + batchSize);
        chunk.forEach(q => {
          const docRef = clientDoc(clientDb, "questions", q.id.toString());
          batch.set(docRef, q);
        });
        await batch.commit();
        console.log(`Migrated ${Math.min(i + batchSize, mcqData.length)}/${mcqData.length} questions...`);
      }
      console.log("Question migration completed successfully.");
    } else {
      console.log(`Database already has ${snapshot.size}+ questions.`);
    }
  } catch (error) {
    console.error("Error migrating questions (Client SDK):", error);
  }
}

// Ensure database is ready
(async () => {
  await ensureDefaultUsers();
  await migrateQuestions();
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to get all questions
  app.get("/api/questions", async (req, res) => {
    try {
      const snapshot = await clientGetDocs(clientCollection(clientDb, "questions"));
      const questions = snapshot.docs.map(doc => doc.data());
      // Sort in-memory if needed
      questions.sort((a: any, b: any) => a.id - b.id);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // API to check user status
  app.get("/api/user-status", async (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const userEmail = email.toLowerCase().trim();
    try {
      const userDoc = await clientGetDoc(clientDoc(clientDb, "users", userEmail));
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
  app.post("/api/admin/update-status", async (req, res) => {
    const { email, status } = req.body;
    if (!email || !status) {
      return res.status(400).json({ error: "Email and status are required" });
    }
    
    const userEmail = email.toLowerCase().trim();
    try {
      await clientSetDoc(clientDoc(clientDb, "users", userEmail), { email: userEmail, status }, { merge: true });
      res.json({ message: "Success", user: { email: userEmail, status } });
    } catch (error: any) {
      console.error("Error updating user status:", error);
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
      console.error("Error deleting user:", error);
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
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
