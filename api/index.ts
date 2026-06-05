import "dotenv/config";
import express from "express";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const questionsContainer = database.container("questions");
const mainsQuestionsContainer = database.container("mains-questions");
const usersContainer = database.container("users");
const toppersContainer = database.container("toppers-copy");
const loginHistoryContainer = database.container("login-history");

const serverApp = express();
serverApp.use(express.json());

// Permanent admins (cannot be demoted)
const PERMANENT_ADMINS = ["kitpitbaisa@gmail.com"];

// In-memory cache for questions (refreshes every 5 minutes)
let questionsCache: any[] | null = null;
let cacheTimestamp = 0;
let mainsCache: any[] | null = null;
let mainsCacheTimestamp = 0;
let toppersCache: any[] | null = null;
let toppersCacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour (use /api/admin/refresh-questions to force clear)

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

async function getMainsQuestions() {
  const now = Date.now();
  if (mainsCache && (now - mainsCacheTimestamp) < CACHE_TTL) {
    return mainsCache;
  }
  const { resources } = await mainsQuestionsContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  mainsCache = resources;
  mainsCacheTimestamp = now;
  return resources;
}

async function getToppersQuestions() {
  const now = Date.now();
  if (toppersCache && (now - toppersCacheTimestamp) < CACHE_TTL) {
    return toppersCache;
  }
  const { resources } = await toppersContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  toppersCache = resources;
  toppersCacheTimestamp = now;
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

// API to get all mains questions (cached)
serverApp.get("/api/mains-questions", async (req, res) => {
  try {
    const mainsQuestions = await getMainsQuestions();
    mainsQuestions.sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(mainsQuestions);
  } catch (error: any) {
    console.error("Error fetching mains questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all toppers copy questions (cached)
serverApp.get("/api/toppers-copy", async (req, res) => {
  try {
    const toppersQuestions = await getToppersQuestions();
    toppersQuestions.sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(toppersQuestions);
  } catch (error: any) {
    console.error("Error fetching toppers copy questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to refresh questions cache (admin only)
serverApp.post("/api/admin/refresh-questions", async (req, res) => {
  try {
    questionsCache = null;
    cacheTimestamp = 0;
    mainsCache = null;
    mainsCacheTimestamp = 0;
    const [questions, mainsQuestions] = await Promise.all([getQuestions(), getMainsQuestions()]);
    res.json({
      message: "Cache refreshed",
      count: questions.length,
      mainsCount: mainsQuestions.length,
    });
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
  const now = new Date().toISOString();
  try {
    // Check if user already exists
    let existing: any = null;
    try {
      const { resource } = await usersContainer.item(userEmail, userEmail).read();
      existing = resource;
    } catch (e: any) {}

    const expiryDate = status === "subscribed"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : existing?.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await usersContainer.items.upsert({
      id: userEmail,
      email: userEmail,
      status,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      expiryDate,
      isActive: true,
    });
    res.json({ message: "Success", user: { email: userEmail, status } });
  } catch (error: any) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to delete user (soft delete)
serverApp.delete("/api/admin/users/:email", async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  const now = new Date().toISOString();
  try {
    let existing: any = null;
    try {
      const { resource } = await usersContainer.item(email, email).read();
      existing = resource;
    } catch (e: any) {}

    if (existing) {
      await usersContainer.items.upsert({
        ...existing,
        isActive: false,
        modifiedAt: now,
      });
    }
    res.json({ message: "User deactivated" });
  } catch (error: any) {
    console.error("Error deactivating user:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all users (only active)
serverApp.get("/api/admin/users", async (req, res) => {
  try {
    const { resources } = await usersContainer.items
      .query("SELECT c.id, c.email, c.status, c.expiryDate, c.createdAt, c.isActive FROM c WHERE NOT IS_DEFINED(c.isActive) OR c.isActive = true")
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to backfill existing users with audit fields
serverApp.post("/api/admin/users/backfill", async (req, res) => {
  try {
    const { resources } = await usersContainer.items
      .query("SELECT * FROM c WHERE NOT IS_DEFINED(c.isActive) OR c.isActive = true")
      .fetchAll();
    const now = new Date().toISOString();
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    let updated = 0;
    for (const user of resources) {
      if (!user.expiryDate || !user.createdAt) {
        await usersContainer.items.upsert({
          ...user,
          createdAt: user.createdAt || now,
          modifiedAt: now,
          expiryDate: user.expiryDate || oneYearFromNow,
          isActive: true,
        });
        updated++;
      }
    }
    res.json({ message: `Backfilled ${updated} users`, total: resources.length });
  } catch (error: any) {
    console.error("Error backfilling users:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to track user login
serverApp.post("/api/auth/track-login", async (req, res) => {
  const { email, device, browser, os, screenWidth } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const userEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const sessionId = `${userEmail}-${Date.now()}`;

  try {
    await loginHistoryContainer.items.create({
      id: sessionId,
      email: userEmail,
      device: device || "unknown",
      browser: browser || "unknown",
      os: os || "unknown",
      screenWidth: screenWidth || null,
      ip,
      loginAt: now,
      isActive: true,
    });
    res.json({ message: "Login tracked", sessionId });
  } catch (error: any) {
    console.error("Error tracking login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to track logout (mark session inactive)
serverApp.post("/api/auth/track-logout", async (req, res) => {
  const { email, sessionId } = req.body;
  if (!email || !sessionId) return res.status(400).json({ error: "Email and sessionId required" });

  const userEmail = email.toLowerCase().trim();
  try {
    const { resource } = await loginHistoryContainer.item(sessionId, userEmail).read();
    if (resource) {
      await loginHistoryContainer.items.upsert({
        ...resource,
        isActive: false,
        logoutAt: new Date().toISOString(),
      });
    }
    res.json({ message: "Logout tracked" });
  } catch (error: any) {
    console.error("Error tracking logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to get login history for a user
serverApp.get("/api/admin/login-history/:email", async (req, res) => {
  const email = req.params.email.toLowerCase().trim();
  try {
    const { resources } = await loginHistoryContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.email = @email ORDER BY c.loginAt DESC OFFSET 0 LIMIT 20",
        parameters: [{ name: "@email", value: email }]
      })
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching login history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API to get active sessions count per user
serverApp.get("/api/admin/active-sessions", async (req, res) => {
  try {
    const { resources } = await loginHistoryContainer.items
      .query("SELECT c.email, COUNT(1) as count FROM c WHERE c.isActive = true GROUP BY c.email")
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default serverApp;
