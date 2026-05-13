import express from "express";
import path from "path";

import { initializeApp } from "firebase/app";
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
  type Firestore,
  terminate
} from "firebase/firestore";
import { mcqData } from "./src/questions";

import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

// Initialize Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
console.log("Firebase Client SDK initialized with Database ID:", firebaseConfig.firestoreDatabaseId);

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

async function ensureDefaultUsers() {
  try {
    const usersCol = collection(db, "users");
    const q = query(usersCol, limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log("Initializing database with default users...");
      const batch = writeBatch(db);
      for (const [email, userData] of Object.entries(defaultUsers)) {
        const docRef = doc(db, "users", email);
        batch.set(docRef, userData);
      }
      await batch.commit();
      console.log("Default users initialized.");
    }
  } catch (error) {
    console.error("Error initializing default users:", error);
  }
}

/**
 * Migration using Client SDK
 */
async function migrateQuestions() {
  try {
    const qCol = collection(db, "questions");
    
    // Check remote count
    const remoteCountSnapshot = await getCountFromServer(qCol);
    const remoteCount = remoteCountSnapshot.data().count;
    
    console.log(`Question Sync Check: Local=${mcqData.length}, Remote=${remoteCount}`);
    
    if (remoteCount >= mcqData.length) {
      console.log("Remote database has equal or more questions. Skipping full sync.");
      return;
    }

    console.log("Remote count is lower. Commencing synchronization...");
    
    // Process in batches of 500 (Firestore limit)
    const batches = [];
    for (let i = 0; i < mcqData.length; i += 500) {
      batches.push(mcqData.slice(i, i + 500));
    }

    for (const chunk of batches) {
      const batch = writeBatch(db);
      chunk.forEach(q => {
        const docRef = doc(db, "questions", q.id.toString());
        batch.set(docRef, q, { merge: true });
      });
      await batch.commit();
      console.log(`Upserted batch of ${chunk.length} questions...`);
    }
    
    console.log("Sync completed.");
  } catch (error) {
    console.error("Error migrating questions:", error);
  }
}

let isInitialized = false;
async function initializeData() {
  if (isInitialized) return;
  console.log("Starting data initialization...");
  await ensureDefaultUsers();
  await migrateQuestions();
  isInitialized = true;
  console.log("Data initialization completed.");
}

const serverApp = express();
const PORT = 3000;

serverApp.use(express.json());

// Export for Vercel
export default serverApp;

// API to get all questions
serverApp.get("/api/questions", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "questions"));
    const questions = snapshot.docs.map(doc => doc.data());
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
    const users = snapshot.docs.map(doc => doc.data());
    res.json(users);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      serverApp.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite not available, skipping middleware.");
    }
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), "dist");
    serverApp.use(express.static(distPath));
    serverApp.get("*", (req, res) => {
      // In production, we assume dist/index.html is the entry point
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Start initialization
if (!process.env.VERCEL) {
  setupVite();
  
  initializeData().catch(err => {
    console.error("Initialization error:", err);
  });

  serverApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
