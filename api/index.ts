import "dotenv/config";
import express from "express";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const questionsContainer = database.container("questions");
const usersContainer = database.container("users");

const serverApp = express();
serverApp.use(express.json());

// Permanent admins (cannot be demoted)
const PERMANENT_ADMINS = ["kitpitbaisa@gmail.com"];

// In-memory cache for questions (refreshes every 5 minutes)
let questionsCache: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getQuestions() {
  const now = Date.now();
  if (questionsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return questionsCache;
  }
  const { resources } = await questionsContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  questionsCache = resources;
  cacheTimestamp = now;
  return resources;
}

// API to get all questions (cached)
serverApp.get("/api/questions", async (req, res) => {
  try {
    const questions = await getQuestions();
    questions.sort((a: any, b: any) => a.id - b.id);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(questions);
  } catch (error: any) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to refresh questions cache (admin only)
serverApp.post("/api/admin/refresh-questions", async (req, res) => {
  try {
    questionsCache = null;
    cacheTimestamp = 0;
    const questions = await getQuestions();
    res.json({ message: "Cache refreshed", count: questions.length });
  } catch (error: any) {
    console.error("Error refreshing cache:", error);
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
    if (PERMANENT_ADMINS.includes(userEmail)) {
      return res.json({ email: userEmail, status: "admin" });
    }
    const { resource } = await usersContainer.item(userEmail, userEmail).read();
    if (resource) {
      res.json({ email: resource.email, status: resource.status });
    } else {
      res.json({ email: userEmail, status: "not_subscribed" });
    }
  } catch (error: any) {
    if (error.code === 404) {
      return res.json({ email: userEmail, status: "not_subscribed" });
    }
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
    await usersContainer.items.upsert({ id: userEmail, email: userEmail, status });
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
    await usersContainer.item(email, email).delete();
    res.json({ message: "User deleted" });
  } catch (error: any) {
    if (error.code === 404) {
      return res.json({ message: "User deleted" });
    }
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all users
serverApp.get("/api/admin/users", async (req, res) => {
  try {
    const { resources } = await usersContainer.items
      .query("SELECT c.id, c.email, c.status FROM c")
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default serverApp;
