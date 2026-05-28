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
  orderBy,
  getCountFromServer,
  type Firestore,
  terminate
} from "firebase/firestore";
import { mcqData } from "./src/questions";

import fs from "fs";

// Helper to load config safely
const getConfig = () => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
       console.warn("firebase-applet-config.json not found.");
       return null;
    }
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("Failed to load firebase-applet-config.json:", error);
    return null;
  }
};

const firebaseConfig = getConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const db = app && firebaseConfig ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;

if (db) {
  console.log("Firebase initialized successfully with Database ID:", firebaseConfig.firestoreDatabaseId);
} else {
  console.warn("Firebase could not be initialized. API routes may fail.");
}

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
  if (!db) return;
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: "server-side-admin", // On server we typically use admin access or at least we don't have request.auth easily here
    operationType,
    path
  };
  const errorMessage = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorMessage);
  throw new Error(errorMessage);
}

/**
 * Migration using Client SDK
 */
async function migrateQuestions() {
  if (!db) return;
  try {
    const qCol = collection(db, "questions");
    
    // Check remote count
    const remoteCountSnapshot = await getCountFromServer(qCol);
    const remoteCount = remoteCountSnapshot.data().count;
    
    console.log(`Question Sync Check: Local=${mcqData.length}, Remote=${remoteCount}`);
    
    let missingQuestions = mcqData;

    if (remoteCount > 0) {
      console.log("Fetching existing IDs to identify missing questions and deletions...");
      
      // Fetch all existing IDs (This costs N reads, but saves 20x vs full sync writes)
      const remoteDocs = await getDocs(qCol);
      const remoteIds = new Set(remoteDocs.docs.map(doc => doc.id));
      
      const localIds = new Set(mcqData.map(q => q.id.toString()));
      
      // Identify questions to add/update
      const remoteData = new Map(remoteDocs.docs.map(doc => [doc.id, doc.data()]));
      missingQuestions = mcqData.filter(q => {
        const remote = remoteData.get(q.id.toString()) as any;
        if (!remote) return true;
        // Update if question or any other key field changed
        return remote.question !== q.question || 
               remote.subject !== q.subject || 
               remote.topic !== q.topic ||
               JSON.stringify(remote.options) !== JSON.stringify(q.options);
      });
      
      console.log(`Identified ${missingQuestions.length} questions that need update/creation.`);
      
      // Identify questions to delete
      const staleQuestionIds = remoteDocs.docs
        .map(doc => doc.id)
        .filter(id => !localIds.has(id));

      if (staleQuestionIds.length > 0) {
        console.log(`Identified ${staleQuestionIds.length} stale questions to delete.`);
        const deleteBatches = [];
        for (let i = 0; i < staleQuestionIds.length; i += 500) {
          deleteBatches.push(staleQuestionIds.slice(i, i + 500));
        }

        for (const chunk of deleteBatches) {
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, "questions", id));
          });
          await batch.commit();
          console.log(`Deleted batch of ${chunk.length} stale questions.`);
        }
      }

      if (missingQuestions.length === 0 && staleQuestionIds.length === 0) {
        console.log("No missing or stale questions found despite count mismatch. This is unusual.");
        return;
      }
    }

    console.log(`Identified ${missingQuestions.length} missing questions. Commencing surgical sync...`);
    
    // Process in batches of 500 (Firestore limit)
    const batches = [];
    for (let i = 0; i < missingQuestions.length; i += 500) {
      batches.push(missingQuestions.slice(i, i + 500));
    }

    for (const chunk of batches) {
      try {
        const batch = writeBatch(db);
        chunk.forEach(q => {
          const docRef = doc(db, "questions", q.id.toString());
          batch.set(docRef, q, { merge: true });
        });
        await batch.commit();
        console.log(`Upserted batch of ${chunk.length} questions...`);
      } catch (batchError: any) {
        if (batchError.code === 'resource-exhausted' || batchError.message?.includes('quota')) {
          console.error("CRITICAL: Firestore Quota Exhausted during batch write. Stopping sync for now.");
          return; // Stop processing further batches
        }
        throw batchError; // Re-throw other errors
      }
    }
    
    console.log("Sync completed.");
  } catch (error: any) {
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      console.error("CRITICAL: Firestore Quota Exhausted. Synchronization will resume tomorrow.");
    } else {
      console.error("Error migrating questions:", error);
    }
    // We don't throw here to avoid crashing the server on start if sync fails
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
  if (!db) return res.status(503).json({ error: "Database not initialized" });
  try {
    const snapshot = await getDocs(collection(db, "questions"));
    const questions = snapshot.docs.map(doc => doc.data());
    
    // If database is empty, fallback to local data
    if (questions.length === 0) {
      return res.json(mcqData);
    }
    
    questions.sort((a: any, b: any) => a.id - b.id);
    res.json(questions);
  } catch (error: any) {
    console.error("Error fetching questions:", error);
    // If quota is exhausted or any other error, fallback to local data for resilience
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      console.warn("Falling back to local data due to Firestore error");
      return res.json(mcqData);
    }
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to check user status
serverApp.get("/api/user-status", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Database not initialized" });
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
  if (!db) return res.status(503).json({ error: "Database not initialized" });
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
  if (!db) return res.status(503).json({ error: "Database not initialized" });
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
  if (!db) return res.status(503).json({ error: "Database not initialized" });
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
