import "dotenv/config";
import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { CosmosClient } from "@azure/cosmos";
import Razorpay from "razorpay";
import crypto from "crypto";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const questionsContainer = database.container("questions");
const mainsQuestionsContainer = database.container("mains-questions");
const csatQuestionsContainer = database.container("csat-questions");
const englishQuestionsContainer = database.container("english-questions");
const usersContainer = database.container("users");
const paymentsContainer = database.container("payments");
const toppersContainer = database.container("toppers-copy");
const loginHistoryContainer = database.container("login-history");

const serverApp = express();
// Capture raw body so we can verify Razorpay webhook signatures.
serverApp.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));

// --- Razorpay payment config ---
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

// Server-side plan catalogue — amount (paise) and duration are trusted from here,
// never from the client, to prevent tampering.
const PAYMENT_PLANS: Record<string, { amount: number; durationDays: number; label: string }> = {
  pyq1: { amount: 89900, durationDays: 365, label: "Powerhouse PYQ Premium - 1 Year" },
  pyq2: { amount: 129900, durationDays: 730, label: "Powerhouse PYQ Premium - 2 Years" },
};

// Ensure the payments container exists (idempotent, cached after first call).
let paymentsContainerReady = false;
async function ensurePaymentsContainer() {
  if (paymentsContainerReady) return;
  await database.containers.createIfNotExists({
    id: "payments",
    partitionKey: { paths: ["/email"] },
  });
  paymentsContainerReady = true;
}

// Grant/extend a subscription for a user. If already subscribed and not expired,
// the new duration stacks on top of the remaining time.
async function grantSubscription(email: string, durationDays: number) {
  const userEmail = email.toLowerCase().trim();
  const now = new Date();
  let existing: any = null;
  try {
    const { resource } = await usersContainer.item(userEmail, userEmail).read();
    existing = resource;
  } catch (e: any) {}

  const currentExpiry = existing?.expiryDate ? new Date(existing.expiryDate) : now;
  const base = currentExpiry > now ? currentExpiry : now;
  const expiryDate = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await usersContainer.items.upsert({
    id: userEmail,
    email: userEmail,
    status: "subscribed",
    createdAt: existing?.createdAt || now.toISOString(),
    modifiedAt: now.toISOString(),
    expiryDate,
    isActive: true,
  });
  return expiryDate;
}

// Permanent admins (cannot be demoted)
const PERMANENT_ADMINS = ["kitpitbaisa@gmail.com"];

// Razorpay payment gateway (server-side only; secret never sent to the browser)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const PLANS: Record<string, { amount: number; days: number; label: string }> = {
  "1yr": { amount: 100, days: 365, label: "Powerhouse PYQ Premium - 1 Year" },
  "2yr": { amount: 100, days: 730, label: "Powerhouse PYQ Premium - 2 Years" },
  "ebooks": { amount: 100, days: 3650, label: "PowerHouse Ebooks - All-in-One Study Material" },
};

// In-memory cache for questions (12h TTL, invalidated via cache-version doc in Cosmos)
let questionsCache: any[] | null = null;
let cacheTimestamp = 0;
let mainsCache: any[] | null = null;
let mainsCacheTimestamp = 0;
let toppersCache: any[] | null = null;
let toppersCacheTimestamp = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Cache version tracking — stored in Cosmos so all serverless instances can see invalidation
let localCacheVersion = 0;

async function getCacheVersion(): Promise<number> {
  try {
    const { resource } = await questionsContainer.item("__cache_version__", "__cache_version__").read();
    return resource?.version || 0;
  } catch {
    return 0;
  }
}

async function bumpCacheVersion(): Promise<void> {
  const newVersion = Date.now();
  await questionsContainer.items.upsert({ id: "__cache_version__", version: newVersion });
  localCacheVersion = newVersion;
}

async function isCacheStale(): Promise<boolean> {
  const remoteVersion = await getCacheVersion();
  if (remoteVersion > localCacheVersion) {
    localCacheVersion = remoteVersion;
    return true;
  }
  return false;
}

async function getQuestions() {
  const now = Date.now();
  const withinTTL = questionsCache && (now - cacheTimestamp) < CACHE_TTL;
  if (withinTTL && !(await isCacheStale())) {
    return questionsCache;
  }
  const { resources } = await questionsContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  // Filter out the cache version doc
  questionsCache = resources.filter((r: any) => r.id !== "__cache_version__");
  cacheTimestamp = now;
  return questionsCache;
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
    const limit = parseInt(req.query.limit as string, 10);
    if (!isNaN(limit) && limit > 0) {
      const top = [...questions]
        .filter((q: any) => q.question && String(q.question).trim() !== "" && !String(q.question).startsWith("Q_"))
        .sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || b.id - a.id)
        .slice(0, limit);
      res.setHeader("Cache-Control", "no-store");
      return res.json(top);
    }
    questions.sort((a: any, b: any) => a.id - b.id);
    res.setHeader("Cache-Control", "no-store");
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
    res.setHeader("Cache-Control", "no-store");
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
    res.setHeader("Cache-Control", "no-store");
    res.json(toppersQuestions);
  } catch (error: any) {
    console.error("Error fetching toppers copy questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all CSAT questions (cached)
let csatCache: any[] | null = null;
let csatCacheTimestamp = 0;
serverApp.get("/api/csat-questions", async (req, res) => {
  try {
    const now = Date.now();
    if (!csatCache || now - csatCacheTimestamp > 300000) {
      const { resources } = await csatQuestionsContainer.items.readAll().fetchAll();
      csatCache = resources;
      csatCacheTimestamp = now;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(csatCache);
  } catch (error: any) {
    console.error("Error fetching CSAT questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all English questions (cached)
let englishCache: any[] | null = null;
let englishCacheTimestamp = 0;
serverApp.get("/api/english-questions", async (req, res) => {
  try {
    const now = Date.now();
    if (!englishCache || now - englishCacheTimestamp > 300000) {
      const { resources } = await englishQuestionsContainer.items.readAll().fetchAll();
      englishCache = resources;
      englishCacheTimestamp = now;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(englishCache);
  } catch (error: any) {
    console.error("Error fetching English questions:", error);
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
    toppersCache = null;
    toppersCacheTimestamp = 0;
    csatCache = null;
    csatCacheTimestamp = 0;
    englishCache = null;
    englishCacheTimestamp = 0;
    // Bump version so ALL serverless instances know cache is stale
    await bumpCacheVersion();
    const [questions, mainsQuestions, toppersQuestions, csatQuestions, englishQuestions] = await Promise.all([
      getQuestions(), getMainsQuestions(), getToppersQuestions(),
      csatQuestionsContainer.items.readAll().fetchAll().then(r => r.resources),
      englishQuestionsContainer.items.readAll().fetchAll().then(r => r.resources),
    ]);
    csatCache = csatQuestions;
    csatCacheTimestamp = Date.now();
    englishCache = englishQuestions;
    englishCacheTimestamp = Date.now();
    res.json({
      message: "Cache refreshed",
      count: questions.length,
      mainsCount: mainsQuestions.length,
      toppersCount: toppersQuestions.length,
      csatCount: csatQuestions.length,
      englishCount: englishQuestions.length,
    });
  } catch (error: any) {
    console.error("Error refreshing cache:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// PATCH /api/admin/update-question - Update answer/explanation for a prelims question
serverApp.patch("/api/admin/update-question", async (req, res) => {
  try {
    const { id, answer, explanation } = req.body;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    if (!answer && explanation === undefined) {
      return res.status(400).json({ error: "Provide at least answer or explanation to update" });
    }

    // Partition key is /id for questions container
    const itemId = String(id);
    const { resource: existing } = await questionsContainer.item(itemId, itemId).read();
    if (!existing) {
      return res.status(404).json({ error: `Question ${id} not found` });
    }

    // Build update — only touch fields that were provided
    if (answer) {
      // Accept full option text directly, or match a single letter to the option
      const trimmed = answer.trim();
      if (trimmed.length === 1) {
        const letter = trimmed.toUpperCase();
        const matchedOption = existing.options?.find((opt: string) =>
          opt.trim().toUpperCase().startsWith(letter + ".")
        );
        existing.answer = matchedOption || answer;
      } else {
        existing.answer = trimmed;
      }
    }
    if (explanation !== undefined) {
      existing.explanation = explanation;
    }

    const { resource: updated } = await questionsContainer.item(itemId, itemId).replace(existing);

    // Update local cache + bump version so all instances re-fetch
    if (questionsCache) {
      questionsCache = questionsCache.map((q: any) =>
        String(q.id) === itemId ? { ...q, answer: updated.answer, explanation: updated.explanation } : q
      );
    }
    await bumpCacheVersion();

    res.json({
      message: "Question updated",
      id: updated.id,
      answer: updated.answer,
      explanation: updated.explanation,
    });
  } catch (error: any) {
    console.error("Error updating question:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// GET /api/admin/upload-questions/schema - Returns unified API documentation for AI consumers
serverApp.get("/api/admin/upload-questions/schema", (req, res) => {
  res.json({
    endpoint: "POST /api/admin/upload-questions",
    description: "Unified API to upload UPSC questions (Prelims MCQs, Mains descriptive, or Topper's Copy answers). Handles deduplication: if a question with the same year + exam + question text exists, it updates (adds topper answers for toppers type, skips for prelims/mains). Otherwise creates a new document.",
    request: {
      method: "POST",
      contentType: "application/json",
      body: {
        type: { type: "string", required: true, enum: ["prelims", "mains", "toppers"], description: "Type of questions being uploaded." },
        questions: {
          type: "array", required: true, description: "Array of question objects. Schema depends on 'type'.",
          schemas: {
            prelims: { fields: { year: "string (required)", exam: "string (required)", subject: "string (required)", question: "string (required)", options: "string[] (required, A./B./C./D. prefixed)", answer: "string (required, must match an option)", explanation: "string (optional)" } },
            mains: { fields: { year: "string (required)", exam: "string (required)", subject: "string (required)", topic: "string (optional)", paper: "string (optional, GS1-GS4/Essay)", question: "string (required)", keywords: "string[] (optional)" } },
            toppers: { fields: { year: "string (required)", exam: "string (required)", subject: "string (optional)", topic: "string (optional)", paper: "string (optional, GS1-GS4)", questionNumber: "number (optional)", question: "string (required)", marks: "number (optional)", words: "number (optional)", answers: "array (required) [{topperName, rank, toppers_copy_section, topperAnswerText}]" } }
          }
        }
      }
    },
    behavior: {
      deduplication: "Matches by normalized question text + same year + same exam",
      prelims: "Duplicate → skip. New → auto-ID + create.",
      mains: "Duplicate → skip. New → auto-ID + create.",
      toppers: "Duplicate → append new topper answers. New → auto-ID + create.",
      cache: "Clears relevant cache after upload"
    }
  });
});

// Unified API to upload questions (prelims, mains, toppers)
serverApp.post("/api/admin/upload-questions", async (req, res) => {
  try {
    const { type, questions } = req.body;
    if (!type || !["prelims", "mains", "toppers"].includes(type)) {
      return res.status(400).json({ error: "type is required and must be 'prelims', 'mains', or 'toppers'" });
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "questions array is required and must not be empty" });
    }

    const container = type === "prelims" ? questionsContainer : type === "mains" ? mainsQuestionsContainer : toppersContainer;
    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    const { resources: existing } = await container.items.query("SELECT * FROM c").fetchAll();
    let maxId = existing.reduce((max, q) => Math.max(max, parseInt(q.id) || 0), 0);
    const normalizeText = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

    for (const q of questions) {
      try {
        if (!q.year || !q.exam || !q.question) {
          results.errors.push(`Skipped: missing required fields (year/exam/question)`);
          continue;
        }

        const match = existing.find(e =>
          e.year === q.year && e.exam === q.exam && normalizeText(e.question) === normalizeText(q.question)
        );

        if (match) {
          if (type === "toppers" && q.answers?.length > 0) {
            const existingNames = new Set(match.answers?.map((a: any) => a.topperName) || []);
            const newAnswers = q.answers.filter((a: any) => !existingNames.has(a.topperName));
            if (newAnswers.length > 0) {
              match.answers = [...(match.answers || []), ...newAnswers];
              const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = match;
              await container.items.upsert(cleanDoc);
              results.updated++;
            } else { results.skipped++; }
          } else { results.skipped++; }
        } else {
          maxId++;
          let newDoc: any;
          if (type === "prelims") {
            if (!q.options || !q.answer) { results.errors.push(`Skipped: prelims missing options/answer`); continue; }
            newDoc = { id: String(maxId), year: q.year, exam: q.exam, subject: q.subject || "", question: q.question, options: q.options, answer: q.answer, explanation: q.explanation || "" };
          } else if (type === "mains") {
            newDoc = { id: String(maxId), year: q.year, exam: q.exam, subject: q.subject || "", topic: q.topic || "", paper: q.paper || "", question: q.question, keywords: q.keywords || [] };
          } else {
            if (!q.answers || q.answers.length === 0) { results.errors.push(`Skipped: toppers missing answers`); continue; }
            newDoc = { id: String(maxId), questionNumber: q.questionNumber || maxId - 30000, year: q.year, exam: q.exam, subject: q.subject || "", topic: q.topic || "", question: q.question, marks: q.marks || null, words: q.words || null, answers: q.answers };
          }
          await container.items.upsert(newDoc);
          existing.push(newDoc);
          results.created++;
        }
      } catch (itemError: any) { results.errors.push(`Error: ${itemError.message}`); }
    }

    if (type === "prelims") { questionsCache = null; cacheTimestamp = 0; }
    else if (type === "mains") { mainsCache = null; mainsCacheTimestamp = 0; }
    else { toppersCache = null; toppersCacheTimestamp = 0; }

    res.json({ message: "Upload complete", type, ...results, totalInDb: existing.length });
  } catch (error: any) {
    console.error("Error uploading questions:", error);
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

// ── Razorpay: create an order (amount fixed server-side per plan) ──
serverApp.post("/api/payment/create-order", async (req, res) => {
  try {
    const { email, plan } = req.body || {};
    const p = PLANS[plan];
    if (!email || !p) {
      return res.status(400).json({ error: "Valid email and plan are required" });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Payment gateway not configured" });
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: p.amount,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
        notes: { email: String(email).toLowerCase().trim(), plan },
      }),
    });
    const order: any = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order error:", order);
      return res.status(502).json({ error: "Could not create order", details: order?.error?.description });
    }
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID, plan });
  } catch (error: any) {
    console.error("create-order error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Razorpay: verify the payment signature and activate the subscription ──
serverApp.post("/api/payment/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, plan } = req.body || {};
    const p = PLANS[plan];
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email || !p) {
      return res.status(400).json({ error: "Missing verification fields" });
    }
    const expected = createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (
      expected.length !== razorpay_signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))
    ) {
      return res.status(400).json({ error: "Payment signature verification failed" });
    }

    const userEmail = String(email).toLowerCase().trim();
    const now = new Date().toISOString();
    let existing: any = null;
    try {
      const { resource } = await usersContainer.item(userEmail, userEmail).read();
      existing = resource;
    } catch (e) {}
    const expiryDate = new Date(Date.now() + p.days * 24 * 60 * 60 * 1000).toISOString();
    await usersContainer.items.upsert({
      id: userEmail,
      email: userEmail,
      status: "subscribed",
      plan,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      expiryDate,
      isActive: true,
      lastPaymentId: razorpay_payment_id,
    });
    res.json({ success: true, status: "subscribed", expiryDate });
  } catch (error: any) {
    console.error("verify error:", error);
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

// ============ RAZORPAY PAYMENT ENDPOINTS ============

// Create a Razorpay order for a plan.
serverApp.post("/api/payment/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: "Payment gateway not configured" });
    }
    const { email, planId } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });
    const plan = PAYMENT_PLANS[planId];
    if (!plan) return res.status(400).json({ error: "Invalid planId" });

    const userEmail = String(email).toLowerCase().trim();
    await ensurePaymentsContainer();

    const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: "INR",
      receipt,
      notes: { email: userEmail, planId },
    });

    await paymentsContainer.items.upsert({
      id: order.id,
      email: userEmail,
      orderId: order.id,
      planId,
      amount: plan.amount,
      durationDays: plan.durationDays,
      productInfo: plan.label,
      status: "created",
      gateway: "razorpay",
      createdAt: new Date().toISOString(),
    });

    res.json({
      orderId: order.id,
      amount: plan.amount,
      currency: "INR",
      keyId: razorpayKeyId,
      productInfo: plan.label,
      planId,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Verify a completed payment (called by the frontend after checkout).
serverApp.post("/api/payment/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, planId } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }
    const plan = PAYMENT_PLANS[planId];
    if (!plan) return res.status(400).json({ error: "Invalid planId" });

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await ensurePaymentsContainer();
      try {
        const { resource } = await paymentsContainer.item(razorpay_order_id, String(email).toLowerCase().trim()).read();
        if (resource) {
          await paymentsContainer.items.upsert({ ...resource, status: "signature_failed", modifiedAt: new Date().toISOString() });
        }
      } catch (e: any) {}
      return res.status(400).json({ error: "Payment verification failed" });
    }

    await ensurePaymentsContainer();
    const userEmail = String(email).toLowerCase().trim();

    // Read the pending order to trust the server-side amount/duration.
    let record: any = null;
    try {
      const { resource } = await paymentsContainer.item(razorpay_order_id, userEmail).read();
      record = resource;
    } catch (e: any) {}

    const durationDays = record?.durationDays || plan.durationDays;
    const expiryDate = await grantSubscription(userEmail, durationDays);

    await paymentsContainer.items.upsert({
      id: razorpay_order_id,
      email: userEmail,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      planId,
      amount: record?.amount || plan.amount,
      durationDays,
      productInfo: plan.label,
      status: "success",
      gateway: "razorpay",
      createdAt: record?.createdAt || new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    });

    res.json({ success: true, status: "subscribed", expiryDate });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Server-to-server webhook (backup confirmation if the browser closes early).
serverApp.post("/api/payment/webhook", async (req, res) => {
  try {
    if (!razorpayWebhookSecret) {
      return res.status(200).json({ ok: true, note: "webhook secret not configured" });
    }
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = (req as any).rawBody;
    if (!signature || !rawBody) return res.status(400).json({ error: "Missing signature" });

    const expected = crypto.createHmac("sha256", razorpayWebhookSecret).update(rawBody).digest("hex");
    if (expected !== signature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    const entity = req.body?.payload?.payment?.entity;
    if (event === "payment.captured" && entity) {
      await ensurePaymentsContainer();
      const orderId = entity.order_id;
      const email = (entity.notes?.email || "").toLowerCase().trim();
      const planId = entity.notes?.planId;
      const plan = PAYMENT_PLANS[planId];
      if (orderId && email && plan) {
        let record: any = null;
        try {
          const { resource } = await paymentsContainer.item(orderId, email).read();
          record = resource;
        } catch (e: any) {}
        // Only act if not already marked success by the verify endpoint.
        if (!record || record.status !== "success") {
          const durationDays = record?.durationDays || plan.durationDays;
          const expiryDate = await grantSubscription(email, durationDays);
          await paymentsContainer.items.upsert({
            id: orderId,
            email,
            orderId,
            paymentId: entity.id,
            planId,
            amount: entity.amount,
            durationDays,
            productInfo: plan.label,
            status: "success",
            gateway: "razorpay",
            source: "webhook",
            createdAt: record?.createdAt || new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
            expiryDate,
          });
        }
      }
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default serverApp;
