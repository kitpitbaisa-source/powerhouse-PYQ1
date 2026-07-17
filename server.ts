import "dotenv/config";
import express from "express";
import path from "path";
import { timingSafeEqual, createHmac } from "crypto";
import { CosmosClient } from "@azure/cosmos";

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
const toppersContainer = database.container("toppers-copy");
const loginHistoryContainer = database.container("login-history");

console.log("Cosmos DB client initialized for:", endpoint);

// Permanent admins (cannot be demoted)
const PERMANENT_ADMINS = ["kitpitbaisa@gmail.com"];

// Secret admin key (server-side only, never sent to the browser).
// Set ADMIN_API_KEY in .env locally and in the Vercel dashboard for production.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

// Razorpay payment gateway (server-side only; secret never sent to the browser)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

// Plans and their price (in paise) + subscription length. Amount is decided
// here on the server so it can never be tampered with from the client.
const PLANS: Record<string, { amount: number; days: number; label: string }> = {
  "1yr": { amount: 100, days: 365, label: "Powerhouse PYQ Premium - 1 Year" },
  "2yr": { amount: 129900, days: 730, label: "Powerhouse PYQ Premium - 2 Years" },
  "ebooks": { amount: 94900, days: 3650, label: "PowerHouse Ebooks - All-in-One Study Material" },
};

const serverApp = express();
const PORT = 3000;

serverApp.use(express.json());
// PayU posts its callbacks as application/x-www-form-urlencoded
serverApp.use(express.urlencoded({ extended: true }));

// Guard: every /api/admin/* route requires a valid admin key in the
// Authorization header. Requests without it are rejected with 401.
function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = ADMIN_API_KEY;
  const authorized =
    expected.length > 0 &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!authorized) {
    return res.status(401).json({ error: "Unauthorized: valid admin key required" });
  }
  next();
}
serverApp.use("/api/admin", requireAdmin);

// Export for Vercel
export default serverApp;

// In-memory cache for questions (refreshes every 5 minutes)
let questionsCache: any[] | null = null;
let cacheTimestamp = 0;
let mainsCache: any[] | null = null;
let mainsCacheTimestamp = 0;
let csatCache: any[] | null = null;
let csatCacheTimestamp = 0;
let englishCache: any[] | null = null;
let englishCacheTimestamp = 0;
let toppersCache: any[] | null = null;
let toppersCacheTimestamp = 0;
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours (use /api/admin/refresh-questions to force clear)

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

async function getCSATQuestions() {
  const now = Date.now();
  if (csatCache && (now - csatCacheTimestamp) < CACHE_TTL) {
    return csatCache;
  }
  const { resources } = await csatQuestionsContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  csatCache = resources;
  csatCacheTimestamp = now;
  return resources;
}

async function getEnglishQuestions() {
  const now = Date.now();
  if (englishCache && (now - englishCacheTimestamp) < CACHE_TTL) {
    return englishCache;
  }
  const { resources } = await englishQuestionsContainer.items
    .readAll({ maxItemCount: -1 })
    .fetchAll();
  englishCache = resources;
  englishCacheTimestamp = now;
  return resources;
}

// API to get all questions (cached). Supports ?limit=N to return only the
// top N in display order (year desc, id desc) for fast initial paint.
serverApp.get("/api/questions", async (req, res) => {
  try {
    const questions = await getQuestions();
    const limit = parseInt(req.query.limit as string, 10);
    if (!isNaN(limit) && limit > 0) {
      const top = [...questions]
        .filter((q: any) => q.question && String(q.question).trim() !== "" && !String(q.question).startsWith("Q_"))
        .sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || b.id - a.id)
        .slice(0, limit);
      return res.json(top);
    }
    questions.sort((a: any, b: any) => a.id - b.id);
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

serverApp.get("/api/toppers-copy", async (req, res) => {
  try {
    const toppersQuestions = await getToppersQuestions();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(toppersQuestions);
  } catch (error: any) {
    console.error("Error fetching toppers copy questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all CSAT questions (cached)
serverApp.get("/api/csat-questions", async (req, res) => {
  try {
    const csatQuestions = await getCSATQuestions();
    csatQuestions.sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(csatQuestions);
  } catch (error: any) {
    console.error("Error fetching CSAT questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to get all English questions (cached)
serverApp.get("/api/english-questions", async (req, res) => {
  try {
    const englishQuestions = await getEnglishQuestions();
    englishQuestions.sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || String(a.id).localeCompare(String(b.id)));
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json(englishQuestions);
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
    csatCache = null;
    csatCacheTimestamp = 0;
    englishCache = null;
    englishCacheTimestamp = 0;
    toppersCache = null;
    toppersCacheTimestamp = 0;
    const [questions, mainsQuestions, csatQuestions, englishQuestions] = await Promise.all([
      getQuestions(), 
      getMainsQuestions(),
      getCSATQuestions(),
      getEnglishQuestions()
    ]);
    res.json({
      message: "Cache refreshed",
      count: questions.length,
      mainsCount: mainsQuestions.length,
      csatCount: csatQuestions.length,
      englishCount: englishQuestions.length,
    });
  } catch (error: any) {
    console.error("Error refreshing cache:", error);
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
        type: { type: "string", required: true, enum: ["prelims", "mains", "toppers"], description: "Type of questions being uploaded. Determines which database container and schema to use." },
        questions: {
          type: "array",
          required: true,
          description: "Array of question objects. Schema depends on 'type' field above.",
          schemas: {
            prelims: {
              description: "MCQ questions for Prelims exams (CSE Prelims, CDS, NDA, CAPF, etc.)",
              fields: {
                year: { type: "string", required: true, example: "2024", description: "Exam year" },
                exam: { type: "string", required: true, example: "CSE Prelims 2024", description: "Full exam name with year" },
                subject: { type: "string", required: true, example: "History", description: "Subject (History, Geography, Polity, Economics, Science & Technology, Environment, Art & Culture, Current Affairs)" },
                question: { type: "string", required: true, description: "Full question text" },
                options: { type: "array of strings", required: true, example: ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"], description: "MCQ options prefixed with A. B. C. D." },
                answer: { type: "string", required: true, example: "B. Option 2", description: "Correct answer (must match one of the options exactly)" },
                explanation: { type: "string", required: false, description: "Explanation of why the answer is correct" }
              }
            },
            mains: {
              description: "Descriptive questions for Mains exam (GS1-GS4, Essay, Optional papers)",
              fields: {
                year: { type: "string", required: true, example: "2024", description: "Exam year" },
                exam: { type: "string", required: true, example: "CSE Mains", description: "Exam name" },
                subject: { type: "string", required: true, example: "History", description: "Subject category" },
                topic: { type: "string", required: false, example: "Modern Indian History", description: "Specific topic" },
                paper: { type: "string", required: false, example: "GS1", description: "Paper name (GS1, GS2, GS3, GS4, Essay)" },
                question: { type: "string", required: true, description: "Full question text including word limit if mentioned" },
                keywords: { type: "array of strings", required: false, example: ["Non-Cooperation", "Gandhi", "Civil Disobedience"], description: "Key topics/concepts in the question" }
              }
            },
            toppers: {
              description: "Questions with topper's handwritten answer transcriptions",
              fields: {
                year: { type: "string", required: true, example: "2023", description: "Exam year" },
                exam: { type: "string", required: true, example: "CSE Mains", description: "Exam name" },
                subject: { type: "string", required: false, example: "History", description: "Subject category" },
                topic: { type: "string", required: false, example: "Modern Indian History", description: "Specific topic" },
                paper: { type: "string", required: false, example: "GS1", description: "Paper name (GS1, GS2, GS3, GS4)" },
                questionNumber: { type: "number", required: false, example: 1, description: "Question number in the paper" },
                question: { type: "string", required: true, description: "Full question text" },
                marks: { type: "number", required: false, example: 10, description: "Maximum marks" },
                words: { type: "number", required: false, example: 150, description: "Word limit" },
                answers: {
                  type: "array",
                  required: true,
                  description: "Topper answer transcriptions",
                  items: {
                    topperName: { type: "string", required: true, example: "Aditya Srivastava", description: "Full name of the topper" },
                    rank: { type: "string", required: false, example: "1", description: "UPSC rank" },
                    toppers_copy_section: { type: "string", required: false, example: "Aditya Srivastava GSI 2023", description: "Section/booklet identifier" },
                    topperAnswerText: { type: "string", required: true, description: "Full transcription of handwritten answer. Use \\n for newlines, **bold** for emphasis, > for highlighted points, * for bullets." }
                  }
                }
              }
            }
          }
        }
      }
    },
    response: {
      success: { message: "string", created: "number", updated: "number", skipped: "number", errors: "string[]", totalInDb: "number" },
      error: { error: "string", details: "string" }
    },
    behavior: {
      deduplication: "Matches by normalized question text (trimmed, lowercased, collapsed whitespace) + same year + same exam",
      prelims: "If duplicate found, skips. New questions get auto-generated IDs.",
      mains: "If duplicate found, skips. New questions get auto-generated IDs.",
      toppers: "If duplicate found, appends new topper answers (skips if topperName already exists). New questions get auto-generated IDs.",
      cache: "Clears relevant cache after upload so changes are immediately visible"
    },
    examples: {
      prelims: {
        type: "prelims",
        questions: [{
          year: "2024", exam: "CSE Prelims 2024", subject: "Geography",
          question: "Which of the following is the largest plateau in the world?",
          options: ["A. Deccan Plateau", "B. Tibetan Plateau", "C. Colorado Plateau", "D. Antarctic Plateau"],
          answer: "B. Tibetan Plateau",
          explanation: "The Tibetan Plateau, also known as the Qinghai-Tibet Plateau, is the largest and highest plateau in the world, with an average elevation exceeding 4,500 meters."
        }]
      },
      mains: {
        type: "mains",
        questions: [{
          year: "2024", exam: "CSE Mains", subject: "History", topic: "Freedom Struggle",
          paper: "GS1",
          question: "Discuss the role of peasant movements in India's national movement. (250 words)",
          keywords: ["Peasant Movements", "Champaran", "Kheda", "Tebhaga"]
        }]
      },
      toppers: {
        type: "toppers",
        questions: [{
          year: "2023", exam: "CSE Mains", subject: "History", topic: "Modern Indian History", paper: "GS1",
          questionNumber: 1, question: "Discuss the role of the Non-Cooperation Movement.", marks: 15, words: 200,
          answers: [{
            topperName: "Aditya Srivastava", rank: "1",
            topperAnswerText: "The Non-Cooperation Movement (1920-22)...\n* Mass participation\n* British administration paralyzed"
          }]
        }]
      }
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

    // Get existing questions for deduplication
    const { resources: existing } = await container.items.query("SELECT * FROM c").fetchAll();
    let maxId = existing.reduce((max, q) => Math.max(max, parseInt(q.id) || 0), 0);
    const normalizeText = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

    for (const q of questions) {
      try {
        if (!q.year || !q.exam || !q.question) {
          results.errors.push(`Skipped: missing required fields (year/exam/question)`);
          continue;
        }

        // Find existing match
        const match = existing.find(e =>
          e.year === q.year &&
          e.exam === q.exam &&
          normalizeText(e.question) === normalizeText(q.question)
        );

        if (match) {
          if (type === "toppers" && q.answers?.length > 0) {
            // For toppers: append new answers
            const existingNames = new Set(match.answers?.map((a: any) => a.topperName) || []);
            const newAnswers = q.answers.filter((a: any) => !existingNames.has(a.topperName));
            if (newAnswers.length > 0) {
              match.answers = [...(match.answers || []), ...newAnswers];
              const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = match;
              await container.items.upsert(cleanDoc);
              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            results.skipped++;
          }
        } else {
          // Create new document based on type
          maxId++;
          let newDoc: any;

          if (type === "prelims") {
            if (!q.options || !q.answer) {
              results.errors.push(`Skipped: prelims question missing options or answer`);
              continue;
            }
            newDoc = {
              id: String(maxId),
              year: q.year,
              exam: q.exam,
              subject: q.subject || "",
              question: q.question,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation || ""
            };
          } else if (type === "mains") {
            newDoc = {
              id: String(maxId),
              year: q.year,
              exam: q.exam,
              subject: q.subject || "",
              topic: q.topic || "",
              paper: q.paper || "",
              question: q.question,
              keywords: q.keywords || []
            };
          } else {
            // toppers
            if (!q.answers || q.answers.length === 0) {
              results.errors.push(`Skipped: toppers question missing answers array`);
              continue;
            }
            newDoc = {
              id: String(maxId),
              questionNumber: q.questionNumber || maxId - 30000,
              year: q.year,
              exam: q.exam,
              subject: q.subject || "",
              topic: q.topic || "",
              question: q.question,
              marks: q.marks || null,
              words: q.words || null,
              answers: q.answers
            };
          }

          await container.items.upsert(newDoc);
          existing.push(newDoc);
          results.created++;
        }
      } catch (itemError: any) {
        results.errors.push(`Error: ${itemError.message}`);
      }
    }

    // Clear relevant caches
    if (type === "prelims") { questionsCache = null; cacheTimestamp = 0; }
    else if (type === "mains") { mainsCache = null; mainsCacheTimestamp = 0; }
    else { toppersCache = null; toppersCacheTimestamp = 0; }

    res.json({ message: "Upload complete", type, ...results, totalInDb: existing.length });
  } catch (error: any) {
    console.error("Error uploading questions:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Keep old endpoint for backward compatibility
serverApp.post("/api/admin/upload-toppers", async (req, res) => {
  // Redirect to unified endpoint
  req.body.type = "toppers";
  const url = `${req.protocol}://${req.get('host')}/api/admin/upload-questions`;
  try {
    const { type, questions } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "questions array is required" });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
    const { resources: existing } = await toppersContainer.items.query("SELECT * FROM c").fetchAll();
    let maxId = existing.reduce((max, q) => Math.max(max, parseInt(q.id) || 0), 0);
    const normalizeText = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

    for (const q of questions) {
      try {
        if (!q.year || !q.exam || !q.question || !q.answers || q.answers.length === 0) {
          results.errors.push(`Skipped: missing required fields`);
          continue;
        }
        const match = existing.find(e => e.year === q.year && e.exam === q.exam && normalizeText(e.question) === normalizeText(q.question));
        if (match) {
          const existingNames = new Set(match.answers?.map((a: any) => a.topperName) || []);
          const newAnswers = q.answers.filter((a: any) => !existingNames.has(a.topperName));
          if (newAnswers.length > 0) {
            match.answers = [...(match.answers || []), ...newAnswers];
            const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = match;
            await toppersContainer.items.upsert(cleanDoc);
            results.updated++;
          } else { results.skipped++; }
        } else {
          maxId++;
          const newDoc = { id: String(maxId), questionNumber: q.questionNumber || maxId - 30000, year: q.year, exam: q.exam, subject: q.subject || "", topic: q.topic || "", question: q.question, marks: q.marks || null, words: q.words || null, answers: q.answers };
          await toppersContainer.items.upsert(newDoc);
          existing.push(newDoc);
          results.created++;
        }
      } catch (itemError: any) { results.errors.push(`Error: ${itemError.message}`); }
    }
    toppersCache = null; toppersCacheTimestamp = 0;
    res.json({ message: "Upload complete", ...results, totalInDb: existing.length });
  } catch (error: any) {
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
    const distPath = path.join(process.cwd(), "dist");
    serverApp.use(express.static(distPath));
    serverApp.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Start server (local dev only)
if (!process.env.VERCEL) {
  setupVite();
  serverApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
