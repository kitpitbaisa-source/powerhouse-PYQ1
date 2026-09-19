import "dotenv/config";
import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { CosmosClient } from "@azure/cosmos";
import Razorpay from "razorpay";
import crypto from "crypto";
import { getExamCategory } from "../src/exam-utils";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const questionsContainer = database.container("questions");
// State PCS questions live in their own container but are displayed inside Prelims.
const statePcsContainer = database.container("state_pcs");
const mainsQuestionsContainer = database.container("mains-questions");
const csatQuestionsContainer = database.container("csat-questions");
const englishQuestionsContainer = database.container("english-questions");
const usersContainer = database.container("users");
const paymentsContainer = database.container("payments");
const toppersContainer = database.container("toppers-copy");
const loginHistoryContainer = database.container("login-history");
const settingsContainer = database.container("settings");
const feedbackContainer = database.container("feedback");
// Per-user question state: bookmarks, notes and the full attempt history.
const userQuestionsContainer = database.container("user-questions");
const userWorkspaceContainer = database.container("user-workspace");
// Discount coupons applied at checkout (partitioned by the code itself).
const couponsContainer = database.container("coupons");

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

// Secret admin key (server-side only, never sent to the browser).
// Set ADMIN_API_KEY in .env locally and in the Vercel dashboard for production.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

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

// User-owned preferences, bookmarks, notes, and future personalization data.
let userWorkspaceContainerReady = false;
async function ensureUserWorkspaceContainer() {
  if (userWorkspaceContainerReady) return;
  await database.containers.createIfNotExists({
    id: "user-workspace",
    partitionKey: { paths: ["/userId"] },
  });
  userWorkspaceContainerReady = true;
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

// Returns true if the email is a permanent admin, or a stored user whose role
// is 'admin' or 'editor'. Both admins and editors may edit question answers.
// NOTE: there is no per-user login auth, so this trusts the client-supplied
// email — matching the app's existing email-based access model.
async function canEditQuestions(email: string): Promise<boolean> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  if (PERMANENT_ADMINS.includes(e)) return true;
  try {
    const { resource } = await usersContainer.item(e, e).read();
    return !!resource && (resource.status === "admin" || resource.status === "editor");
  } catch {
    return false;
  }
}

// Razorpay payment gateway (server-side only; secret never sent to the browser)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const PLANS: Record<string, { amount: number; days: number; label: string }> = {
  "1yr": { amount: 89900, days: 365, label: "Powerhouse PYQ Premium - 1 Year" },
  "2yr": { amount: 129900, days: 730, label: "Powerhouse PYQ Premium - 2 Years" },
  "ebooks": { amount: 94900, days: 3650, label: "PowerHouse Ebooks - All-in-One Study Material" },
};

// Plan prices can be overridden live from the admin panel (stored in the
// "settings" container). Amounts are always in paise and enforced server-side.
let settingsContainerReady = false;
async function ensureSettingsContainer() {
  if (settingsContainerReady) return;
  await database.containers.createIfNotExists({
    id: "settings",
    partitionKey: { paths: ["/id"] },
  });
  settingsContainerReady = true;
}

// Ensure the feedback container exists (idempotent, cached after first call).
let feedbackContainerReady = false;
async function ensureFeedbackContainer() {
  if (feedbackContainerReady) return;
  await database.containers.createIfNotExists({
    id: "feedback",
    partitionKey: { paths: ["/id"] },
  });
  feedbackContainerReady = true;
}

// Ensure the per-user question container exists (partitioned by user email).
// Holds one document per user+question: bookmark, note and every attempt.
// `notes`/`attempts` are excluded from the index because they are only ever
// read back with the document, never filtered or sorted on.
let userQuestionsContainerReady = false;
async function ensureUserQuestionsContainer() {
  if (userQuestionsContainerReady) return;
  await database.containers.createIfNotExists({
    id: "user-questions",
    partitionKey: { paths: ["/userId"] },
    indexingPolicy: {
      indexingMode: "consistent",
      automatic: true,
      includedPaths: [{ path: "/*" }],
      excludedPaths: [
        { path: "/notes/?" },
        { path: "/attempts/*" },
        { path: '/"_etag"/?' },
      ],
      compositeIndexes: [
        [
          { path: "/isActive", order: "ascending" },
          { path: "/isBookmarked", order: "ascending" },
          { path: "/updatedAt", order: "descending" },
        ],
        [
          { path: "/isActive", order: "ascending" },
          { path: "/hasNote", order: "ascending" },
          { path: "/updatedAt", order: "descending" },
        ],
        [
          { path: "/isActive", order: "ascending" },
          { path: "/questionType", order: "ascending" },
          { path: "/updatedAt", order: "descending" },
        ],
      ],
    },
  });
  userQuestionsContainerReady = true;
}

// Append one attempt to a user's question document, creating it if needed.
// Uses an ETag pre-condition so two devices answering at once cannot drop an
// attempt or corrupt the running counters.
async function appendAttempt(
  userId: string,
  questionType: string,
  questionId: any,
  attempt: { attemptId: string; option: string | null; isCorrect: boolean; timeSpentMs: number | null; ts: string },
  meta: { subject: string | null; topic: string | null; exam: string | null; year: string | null }
) {
  const id = `${questionType}:${questionId}`;

  for (let tries = 0; tries < 5; tries++) {
    let existing: any = null;
    try {
      const { resource } = await userQuestionsContainer.item(id, userId).read();
      existing = resource;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    const attempts = [...(existing?.attempts || []), attempt];
    const correctCount = (existing?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0);
    const wrongCount = (existing?.wrongCount ?? 0) + (attempt.isCorrect ? 0 : 1);
    const notes = existing?.notes ?? "";

    const doc = {
      ...(existing || {}),
      id,
      userId,
      schemaVersion: 1,

      questionId,
      questionType,
      exam: meta.exam ?? existing?.exam ?? null,
      year: meta.year ?? existing?.year ?? null,
      subject: meta.subject ?? existing?.subject ?? null,
      topic: meta.topic ?? existing?.topic ?? null,

      isBookmarked: existing?.isBookmarked ?? false,
      isMarkedForRevision: existing?.isMarkedForRevision ?? false,
      notes,
      hasNote: !!String(notes).trim(),

      attempts,
      attemptCount: attempts.length,
      correctCount,
      wrongCount,
      lastOption: attempt.option,
      lastIsCorrect: attempt.isCorrect,
      lastAttemptId: attempt.attemptId,
      lastAttemptAt: attempt.ts,

      isActive: existing?.isActive ?? true,
      deletedAt: existing?.deletedAt ?? null,

      createdAt: existing?.createdAt || attempt.ts,
      updatedAt: attempt.ts,
    };

    try {
      await userQuestionsContainer.items.upsert(
        doc,
        existing?._etag ? { accessCondition: { type: "IfMatch", condition: existing._etag } } : undefined
      );
      return;
    } catch (error: any) {
      // 412 = another write landed first; re-read and replay the append.
      if (error.code !== 412) throw error;
    }
  }
  throw new Error("Could not save attempt after repeated write conflicts");
}

// Create or update the bookmark / note / revision flags on a user's question
// document without disturbing its attempt history. ETag-guarded like
// appendAttempt so concurrent writes cannot clobber each other.
async function updateQuestionState(
  userId: string,
  questionType: string,
  questionId: any,
  patch: { isBookmarked?: boolean; notes?: string; isMarkedForRevision?: boolean; isActive?: boolean },
  meta: { subject: string | null; topic: string | null; exam: string | null; year: string | null }
) {
  const id = `${questionType}:${questionId}`;

  for (let tries = 0; tries < 5; tries++) {
    let existing: any = null;
    try {
      const { resource } = await userQuestionsContainer.item(id, userId).read();
      existing = resource;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    const now = new Date().toISOString();
    const notes = patch.notes !== undefined ? patch.notes : existing?.notes ?? "";
    const isActive = patch.isActive !== undefined ? patch.isActive : existing?.isActive ?? true;

    const doc = {
      ...(existing || {}),
      id,
      userId,
      schemaVersion: 1,

      questionId,
      questionType,
      exam: meta.exam ?? existing?.exam ?? null,
      year: meta.year ?? existing?.year ?? null,
      subject: meta.subject ?? existing?.subject ?? null,
      topic: meta.topic ?? existing?.topic ?? null,

      isBookmarked: patch.isBookmarked !== undefined ? patch.isBookmarked : existing?.isBookmarked ?? false,
      isMarkedForRevision:
        patch.isMarkedForRevision !== undefined ? patch.isMarkedForRevision : existing?.isMarkedForRevision ?? false,
      notes,
      hasNote: !!String(notes).trim(),

      // Attempt history is owned by appendAttempt; carry it through untouched.
      attempts: existing?.attempts ?? [],
      attemptCount: existing?.attemptCount ?? 0,
      correctCount: existing?.correctCount ?? 0,
      wrongCount: existing?.wrongCount ?? 0,
      lastOption: existing?.lastOption ?? null,
      lastIsCorrect: existing?.lastIsCorrect ?? null,
      lastAttemptId: existing?.lastAttemptId ?? null,
      lastAttemptAt: existing?.lastAttemptAt ?? null,

      isActive,
      deletedAt: isActive ? null : existing?.deletedAt ?? now,

      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      await userQuestionsContainer.items.upsert(
        doc,
        existing?._etag ? { accessCondition: { type: "IfMatch", condition: existing._etag } } : undefined
      );
      return doc;
    } catch (error: any) {
      // 412 = another write landed first; re-read and replay the patch.
      if (error.code !== 412) throw error;
    }
  }
  throw new Error("Could not save question state after repeated write conflicts");
}

// ── Coupons ──────────────────────────────────────────────────────────────────
// One document per code (id = code = partition key) so a lookup is a point read.
// Codes are stored and matched upper-case, and are never hard-deleted: an
// expired or withdrawn coupon is soft-deleted with isActive/deletedAt so past
// redemptions keep their reference.
let couponsContainerReady = false;
async function ensureCouponsContainer() {
  if (couponsContainerReady) return;
  await database.containers.createIfNotExists({
    id: "coupons",
    partitionKey: { paths: ["/code"] },
  });
  couponsContainerReady = true;
}

const normalizeCouponCode = (code: unknown) =>
  String(code || "").toUpperCase().replace(/\s+/g, "").slice(0, 32);

// A coupon is valid through the whole of its expiry day, in IST — the audience
// is Indian, and "expires 30 Sep" should not stop working at 05:30 that morning.
const couponExpiryMs = (expiryDate: string) => {
  const d = new Date(`${String(expiryDate).slice(0, 10)}T23:59:59.999+05:30`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

// Server-side truth for every discount. The browser only ever receives the
// result of this; `create-order` runs it again before charging, so a tampered
// client cannot pay less than the coupon actually allows.
async function evaluateCoupon(
  rawCode: unknown,
  plan: string,
  email: string,
  amount: number
): Promise<
  | { ok: true; coupon: any; discountPercent: number; discountAmount: number; finalAmount: number; error?: undefined }
  | { ok: false; error: string }
> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code" };
  const userEmail = String(email || "").toLowerCase().trim();

  await ensureCouponsContainer();
  let coupon: any = null;
  try {
    const { resource } = await couponsContainer.item(code, code).read();
    coupon = resource;
  } catch {
    coupon = null;
  }
  if (!coupon || coupon.isActive === false) return { ok: false, error: "This coupon code is not valid" };
  if (coupon.expiryDate && couponExpiryMs(coupon.expiryDate) < Date.now()) {
    return { ok: false, error: "This coupon has expired" };
  }
  const plans: string[] = Array.isArray(coupon.plans) ? coupon.plans : [];
  if (plan && plans.length > 0 && !plans.includes(plan)) {
    return { ok: false, error: "This coupon does not apply to the selected plan" };
  }
  const maxRedemptions = Number(coupon.maxRedemptions) || 0;
  if (maxRedemptions > 0 && Number(coupon.redemptionCount || 0) >= maxRedemptions) {
    return { ok: false, error: "This coupon has been fully claimed" };
  }
  // One redemption per user: a successful payment carrying this code is proof.
  // Guests previewing a code have no email yet; checkout always re-checks with one.
  if (userEmail) try {
    await ensurePaymentsContainer();
    const { resources } = await paymentsContainer.items
      .query(
        {
          query: "SELECT VALUE COUNT(1) FROM c WHERE c.couponCode = @code AND c.status = 'success'",
          parameters: [{ name: "@code", value: code }],
        },
        { partitionKey: userEmail }
      )
      .fetchAll();
    if ((resources?.[0] || 0) > 0) return { ok: false, error: "You have already used this coupon" };
  } catch (e: any) {
    console.error("coupon redemption check failed:", e?.message);
  }

  const discountPercent = Math.min(Math.max(Number(coupon.discountPercent) || 0, 1), 100);
  // Razorpay rejects orders under ₹1, so a 100% coupon still charges ₹1.
  const finalAmount = Math.max(Math.round((amount * (100 - discountPercent)) / 100), 100);
  return {
    ok: true,
    coupon,
    discountPercent,
    discountAmount: amount - finalAmount,
    finalAmount,
  };
}

async function getEffectivePlans() {
  const merged: Record<string, { amount: number; days: number; label: string }> =
    JSON.parse(JSON.stringify(PLANS));
  try {
    await ensureSettingsContainer();
    const { resource } = await settingsContainer.item("plan-prices", "plan-prices").read();
    if (resource?.amounts) {
      for (const k of Object.keys(merged)) {
        const a = resource.amounts[k];
        if (typeof a === "number" && a >= 100) merged[k].amount = a;
      }
    }
  } catch (e) {}
  return merged;
}

// In-memory cache for questions (12h TTL, invalidated via cache-version doc in Cosmos)
// Public question banks rarely change, so let Vercel's edge CDN cache them instead of
// hitting the serverless function + Cosmos on every page load (keeps bandwidth/function
// usage down). Edge serves for up to 24h, revalidating in the background for a week.
const PUBLIC_CACHE = "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800";
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
  // Filter out the cache version doc, then merge in State PCS questions so they
  // appear within the Prelims list (stored separately in the state_pcs container).
  const base = resources.filter((r: any) => r.id !== "__cache_version__");
  questionsCache = base.concat(await getStatePcsQuestions());
  cacheTimestamp = now;
  return questionsCache;
}

// Read all State PCS questions. The container may not exist yet, in which case
// we treat it as empty so Prelims keeps working.
async function getStatePcsQuestions() {
  try {
    const { resources } = await statePcsContainer.items
      .readAll({ maxItemCount: -1 })
      .fetchAll();
    // `isActive === false` marks a document retired by a migration (its id was
    // moved to avoid colliding with the `questions` container) — never serve it.
    return resources.filter((r: any) => r.id !== "__cache_version__" && r.isActive !== false);
  } catch (e: any) {
    return [];
  }
}

// Fetch only the top N questions directly from Cosmos in display order
// (year DESC, id DESC). Requires the composite index (year DESC, id DESC) —
// see scripts/add-questions-composite-index.ts. Avoids reading the whole
// collection just to slice the first N (important on serverless cold starts).
async function getTopQuestions(limit: number) {
  const n = Math.max(1, Math.min(Math.floor(limit), 500));
  const query = `SELECT TOP ${n} * FROM c WHERE IS_DEFINED(c.question) AND c.question != "" AND NOT STARTSWITH(c.question, "Q_") ORDER BY c.year DESC, c.id DESC`;
  const { resources } = await questionsContainer.items.query(query).fetchAll();
  return resources.filter((r: any) => r.id !== "__cache_version__");
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
    const limit = parseInt(req.query.limit as string, 10);
    if (!isNaN(limit) && limit > 0) {
      try {
        const top = await getTopQuestions(limit);
        res.setHeader("Cache-Control", PUBLIC_CACHE);
        return res.json(top);
      } catch (e: any) {
        // Composite index may still be building; fall back to cached full read + slice.
        console.warn("getTopQuestions failed, falling back to cached slice:", e?.message);
        const questions = await getQuestions();
        const top = [...questions]
          .filter((q: any) => q.question && String(q.question).trim() !== "" && !String(q.question).startsWith("Q_"))
          .sort((a: any, b: any) => String(b.year).localeCompare(String(a.year)) || b.id - a.id)
          .slice(0, limit);
        res.setHeader("Cache-Control", PUBLIC_CACHE);
        return res.json(top);
      }
    }
    const questions = await getQuestions();
    questions.sort((a: any, b: any) => a.id - b.id);
    res.setHeader("Cache-Control", PUBLIC_CACHE);
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
    res.setHeader("Cache-Control", PUBLIC_CACHE);
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
    res.setHeader("Cache-Control", PUBLIC_CACHE);
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
    res.setHeader("Cache-Control", PUBLIC_CACHE);
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
    res.setHeader("Cache-Control", PUBLIC_CACHE);
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

// PATCH /api/update-question - Update answer/explanation for a Prelims or English question.
// Authorized by the caller's email role (admin or editor), NOT the admin key,
// so designated editors can edit answers without the master key.
serverApp.patch("/api/update-question", async (req, res) => {
  try {
    const { section = "prelims", id, answer, explanation, email } = req.body;
    if (!(await canEditQuestions(email))) {
      return res.status(403).json({ error: "Not authorized to edit questions" });
    }
    if (section !== "prelims" && section !== "english") {
      return res.status(400).json({ error: "section must be prelims or english" });
    }
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    if (!answer && explanation === undefined) {
      return res.status(400).json({ error: "Provide at least answer or explanation to update" });
    }

    const targetContainer = section === "english" ? englishQuestionsContainer : questionsContainer;
    const itemId = String(id);
    const { resource: existing } = await targetContainer.item(itemId, itemId).read();
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

    const { resource: updated } = await targetContainer.item(itemId, itemId).replace(existing);

    // Update local cache + bump version so all instances re-fetch
    if (section === "english") {
      if (englishCache) {
        englishCache = englishCache.map((q: any) =>
          String(q.id) === itemId ? { ...q, answer: updated.answer, explanation: updated.explanation } : q
        );
      }
    } else if (questionsCache) {
      questionsCache = questionsCache.map((q: any) =>
        String(q.id) === itemId ? { ...q, answer: updated.answer, explanation: updated.explanation } : q
      );
    }
    await bumpCacheVersion();

    res.json({
      message: "Question updated",
      section,
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

// Pinned default filters. One document per user holds a key per section
// (`prelims`, `csat`, `english`), so each section can be pinned or unpinned on
// its own. Each section carries its own `isActive` / `createdAt` / `modifiedAt`
// / `deletedAt`, so unpinning one section soft-deletes just that section and
// leaves the others — and the filters it held — intact.
const FILTER_PREFERENCE_SECTIONS = {
  prelims: ["exam", "year", "paper", "subject", "topic"],
  csat: ["year", "subject"],
  english: ["exam", "year", "paper", "subject", "topic"],
} as const;
type FilterPreferenceSection = keyof typeof FILTER_PREFERENCE_SECTIONS;
const FILTER_SORT_MODES = ["latest", "oldest", "score-asc", "score-desc", "attempts-desc", "attempts-asc"];

// A section counts as pinned only when both it and the document are active.
// Sections saved before per-section flags existed have no `isActive`, so an
// undefined flag is treated as active.
const readFilterPreferences = (resource: any) => {
  const out: Record<string, any> = { prelims: null, csat: null, english: null };
  if (!resource || resource.isActive === false) return out;
  for (const section of Object.keys(FILTER_PREFERENCE_SECTIONS)) {
    const value = resource[section];
    out[section] = value && value.isActive !== false ? value : null;
  }
  return out;
};

serverApp.get("/api/filter-preferences", async (req, res) => {
  const email = String(req.query.email || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    await ensureUserWorkspaceContainer();
    const { resource } = await userWorkspaceContainer.item("filter-preferences", email).read();
    res.json(readFilterPreferences(resource));
  } catch (error: any) {
    if (error.code === 404) {
      return res.json({ prelims: null, csat: null, english: null });
    }
    console.error("Error fetching filter preferences:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

serverApp.put("/api/filter-preferences", async (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  // `{ email, prelims }` is the original body shape and is still accepted.
  const section = (String(req.body?.section || "prelims").trim() || "prelims") as FilterPreferenceSection;
  const filters = req.body?.filters ?? req.body?.[section];

  if (!email || !filters || typeof filters !== "object") {
    return res.status(400).json({ error: "Email and filter preferences are required" });
  }
  if (!(section in FILTER_PREFERENCE_SECTIONS)) {
    return res.status(400).json({ error: `Unknown filter section: ${section}` });
  }

  const normalized: Record<string, string> = {};
  for (const field of FILTER_PREFERENCE_SECTIONS[section]) {
    const value = filters[field];
    if (typeof value !== "string" || value.length > 200) {
      return res.status(400).json({ error: `Invalid ${section} filter: ${field}` });
    }
    normalized[field] = value;
  }
  if (filters.sort !== undefined) {
    if (typeof filters.sort !== "string" || !FILTER_SORT_MODES.includes(filters.sort)) {
      return res.status(400).json({ error: `Invalid ${section} filter: sort` });
    }
    normalized.sort = filters.sort;
  }

  try {
    await ensureUserWorkspaceContainer();
    let existing: any = null;
    try {
      const { resource } = await userWorkspaceContainer.item("filter-preferences", email).read();
      existing = resource;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    const now = new Date().toISOString();
    const saved = {
      ...(existing || {}),
      id: "filter-preferences",
      userId: email,
      type: "filter-preferences",
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      // Pinning any section revives a document that was cleared wholesale; the
      // other sections keep their own flags, so they stay unpinned.
      isActive: true,
      deletedAt: null,
      [section]: {
        ...normalized,
        isActive: true,
        createdAt: existing?.[section]?.createdAt || now,
        modifiedAt: now,
        deletedAt: null,
      },
    };
    await userWorkspaceContainer.items.upsert(saved);

    res.json(readFilterPreferences(saved));
  } catch (error: any) {
    console.error("Error saving filter preferences:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

serverApp.delete("/api/filter-preferences", async (req, res) => {
  const email = String(req.query.email || "").toLowerCase().trim();
  const sectionParam = String(req.query.section || "").trim();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (sectionParam && !(sectionParam in FILTER_PREFERENCE_SECTIONS)) {
    return res.status(400).json({ error: `Unknown filter section: ${sectionParam}` });
  }

  try {
    await ensureUserWorkspaceContainer();
    let existing: any = null;
    try {
      const { resource } = await userWorkspaceContainer.item("filter-preferences", email).read();
      existing = resource;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }
    if (existing) {
      const now = new Date().toISOString();
      if (sectionParam) {
        // Unpin one section: soft delete it in place and keep its filters, so
        // the other sections and the document itself are untouched.
        const current = existing[sectionParam];
        await userWorkspaceContainer.items.upsert({
          ...existing,
          modifiedAt: now,
          [sectionParam]: current
            ? { ...current, isActive: false, deletedAt: now, modifiedAt: now }
            : null,
        });
      } else {
        // No section given: clear everything (the original behaviour).
        const cleared: Record<string, any> = {};
        for (const key of Object.keys(FILTER_PREFERENCE_SECTIONS)) {
          if (existing[key]) cleared[key] = { ...existing[key], isActive: false, deletedAt: now, modifiedAt: now };
        }
        await userWorkspaceContainer.items.upsert({
          ...existing,
          ...cleared,
          isActive: false,
          deletedAt: now,
          modifiedAt: now,
        });
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error removing filter preferences:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Razorpay: create an order (amount fixed server-side per plan) ──
serverApp.post("/api/payment/create-order", async (req, res) => {
  try {
    const { email, plan, couponCode } = req.body || {};
    const plans = await getEffectivePlans();
    const p = plans[plan];
    if (!email || !p) {
      return res.status(400).json({ error: "Valid email and plan are required" });
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Payment gateway not configured" });
    }
    // The discount is recomputed here rather than trusted from the client.
    let chargeAmount = p.amount;
    let appliedCoupon: { code: string; discountPercent: number; discountAmount: number } | null = null;
    if (couponCode) {
      const result = await evaluateCoupon(couponCode, plan, email, p.amount);
      if (!result.ok) return res.status(400).json({ error: result.error });
      chargeAmount = result.finalAmount;
      appliedCoupon = {
        code: normalizeCouponCode(couponCode),
        discountPercent: result.discountPercent,
        discountAmount: result.discountAmount,
      };
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: chargeAmount,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
        notes: {
          email: String(email).toLowerCase().trim(),
          plan,
          ...(appliedCoupon ? { coupon: appliedCoupon.code } : {}),
        },
      }),
    });
    const order: any = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order error:", order);
      return res.status(502).json({ error: "Could not create order", details: order?.error?.description });
    }
    // Record the pending payment so we always have an audit trail, even if the
    // user abandons checkout after the order is created.
    try {
      await ensurePaymentsContainer();
      const payerEmail = String(email).toLowerCase().trim();
      await paymentsContainer.items.upsert({
        id: order.id,
        email: payerEmail,
        orderId: order.id,
        plan,
        planLabel: p.label,
        durationDays: p.days,
        amount: order.amount ?? chargeAmount,
        listAmount: p.amount,
        couponCode: appliedCoupon?.code ?? null,
        couponDiscountPercent: appliedCoupon?.discountPercent ?? null,
        couponDiscountAmount: appliedCoupon?.discountAmount ?? null,
        currency: order.currency || "INR",
        status: "created",
        gateway: "razorpay",
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("payments record (create-order) failed:", e?.message);
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
      // Best-effort: flag the pending payment record as failed for the audit trail.
      try {
        await ensurePaymentsContainer();
        const failEmail = String(email).toLowerCase().trim();
        const { resource } = await paymentsContainer.item(razorpay_order_id, failEmail).read();
        if (resource) {
          await paymentsContainer.items.upsert({ ...resource, status: "signature_failed", paymentId: razorpay_payment_id, modifiedAt: new Date().toISOString() });
        }
      } catch (e: any) {}
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
    const newStatus = plan === "ebooks" ? "none" : "subscribed";
    await usersContainer.items.upsert({
      id: userEmail,
      email: userEmail,
      status: newStatus,
      plan,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      expiryDate,
      isActive: true,
      lastPaymentId: razorpay_payment_id,
    });
    // Record the successful payment (id = orderId, partitioned by email).
    try {
      await ensurePaymentsContainer();
      let prior: any = null;
      try {
        const { resource } = await paymentsContainer.item(razorpay_order_id, userEmail).read();
        prior = resource;
      } catch (e: any) {}
      await paymentsContainer.items.upsert({
        id: razorpay_order_id,
        email: userEmail,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        plan,
        planLabel: p.label,
        durationDays: p.days,
        amount: prior?.amount ?? p.amount,
        listAmount: prior?.listAmount ?? p.amount,
        couponCode: prior?.couponCode ?? null,
        couponDiscountPercent: prior?.couponDiscountPercent ?? null,
        couponDiscountAmount: prior?.couponDiscountAmount ?? null,
        currency: prior?.currency || "INR",
        status: "success",
        gateway: "razorpay",
        subscriptionStatus: newStatus,
        expiryDate,
        createdAt: prior?.createdAt || now,
        verifiedAt: now,
      });
      // Count the redemption once the payment is confirmed, so an abandoned
      // checkout never consumes a coupon's limited quota.
      if (prior?.couponCode) {
        try {
          await ensureCouponsContainer();
          const { resource: coupon } = await couponsContainer.item(prior.couponCode, prior.couponCode).read();
          if (coupon) {
            await couponsContainer.items.upsert({
              ...coupon,
              redemptionCount: Number(coupon.redemptionCount || 0) + 1,
              lastRedeemedAt: now,
              modifiedAt: now,
            });
          }
        } catch (e: any) {
          console.error("coupon redemption count failed:", e?.message);
        }
      }
    } catch (e: any) {
      console.error("payments record (verify) failed:", e?.message);
    }
    res.json({ success: true, status: newStatus, expiryDate });
  } catch (error: any) {
    console.error("verify error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Public: current subscription prices (paise) so the UI can display them ──
serverApp.get("/api/plans", async (_req, res) => {
  try {
    const plans = await getEffectivePlans();
    const out: Record<string, number> = {};
    for (const k of Object.keys(plans)) out[k] = plans[k].amount;
    res.json(out);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Public: preview a coupon before checkout (no state is changed here).
// Called without a plan, it returns the discounted price of every plan the
// coupon covers, so the Premium modal can mark them all at once. ──
serverApp.post("/api/coupon/validate", async (req, res) => {
  try {
    const { code, plan, email } = req.body || {};
    const plans = await getEffectivePlans();
    if (plan && !plans[plan]) return res.status(400).json({ valid: false, error: "Select a plan first" });
    const baseAmount = plan ? plans[plan].amount : 0;
    const result = await evaluateCoupon(code, plan || "", email, baseAmount);
    if (!result.ok) return res.status(200).json({ valid: false, error: result.error });
    const eligible: string[] = Array.isArray(result.coupon.plans) && result.coupon.plans.length > 0
      ? result.coupon.plans.filter((k: string) => !!plans[k])
      : Object.keys(plans);
    const amounts: Record<string, { listAmount: number; discountAmount: number; finalAmount: number }> = {};
    for (const k of eligible) {
      const list = plans[k].amount;
      const final = Math.max(Math.round((list * (100 - result.discountPercent)) / 100), 100);
      amounts[k] = { listAmount: list, discountAmount: list - final, finalAmount: final };
    }
    res.json({
      valid: true,
      code: normalizeCouponCode(code),
      discountPercent: result.discountPercent,
      plans: eligible,
      amounts,
      expiryDate: result.coupon.expiryDate || null,
      description: result.coupon.description || null,
    });
  } catch (error: any) {
    console.error("coupon validate error:", error);
    res.status(500).json({ valid: false, error: "Could not check that coupon. Please try again." });
  }
});

// ── Admin: list coupons (active first, newest first). ?includeDeleted=1 to
// also return soft-deleted ones. ──
serverApp.get("/api/admin/coupons", async (req, res) => {
  try {
    await ensureCouponsContainer();
    const includeDeleted = String(req.query.includeDeleted || "") === "1";
    const query = includeDeleted
      ? "SELECT * FROM c ORDER BY c.createdAt DESC"
      : "SELECT * FROM c WHERE NOT IS_DEFINED(c.isActive) OR c.isActive = true ORDER BY c.createdAt DESC";
    const { resources } = await couponsContainer.items.query(query).fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Admin: create or update a coupon (upsert by code) ──
serverApp.post("/api/admin/coupons", async (req, res) => {
  try {
    const { code, discountPercent, expiryDate, plans, maxRedemptions, description, isActive } = req.body || {};
    const id = normalizeCouponCode(code);
    if (!id || id.length < 3) {
      return res.status(400).json({ error: "Coupon code must be at least 3 characters" });
    }
    const percent = Number(discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      return res.status(400).json({ error: "Discount must be between 1% and 100%" });
    }
    if (!expiryDate || couponExpiryMs(expiryDate) === 0) {
      return res.status(400).json({ error: "A valid expiry date is required" });
    }
    const validPlans = Object.keys(PLANS);
    const planList = Array.isArray(plans) ? plans.filter((x: any) => validPlans.includes(x)) : [];
    if (planList.length === 0) {
      return res.status(400).json({ error: "Select at least one plan" });
    }
    const cap = Number(maxRedemptions);
    if (maxRedemptions !== undefined && maxRedemptions !== null && maxRedemptions !== "" && (!Number.isFinite(cap) || cap < 0)) {
      return res.status(400).json({ error: "Redemption limit must be 0 (unlimited) or higher" });
    }

    await ensureCouponsContainer();
    let existing: any = null;
    try {
      const { resource } = await couponsContainer.item(id, id).read();
      existing = resource;
    } catch {}
    const now = new Date().toISOString();
    const doc = {
      id,
      code: id,
      discountPercent: Math.round(percent),
      expiryDate: String(expiryDate).slice(0, 10),
      plans: planList,
      maxRedemptions: Number.isFinite(cap) ? Math.round(cap) : 0,
      description: (description && String(description).trim().slice(0, 200)) || null,
      // Counters survive an edit: editing a coupon must not reset its usage.
      redemptionCount: Number(existing?.redemptionCount || 0),
      lastRedeemedAt: existing?.lastRedeemedAt ?? null,
      isActive: isActive === undefined ? existing?.isActive !== false : !!isActive,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      deletedAt: null,
    };
    await couponsContainer.items.upsert(doc);
    res.json({ success: true, coupon: doc });
  } catch (error: any) {
    console.error("Error saving coupon:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Admin: withdraw a coupon (soft delete — the document is kept so past
// redemptions still resolve) ──
serverApp.delete("/api/admin/coupons/:code", async (req, res) => {
  try {
    const id = normalizeCouponCode(req.params.code);
    await ensureCouponsContainer();
    const { resource } = await couponsContainer.item(id, id).read();
    if (!resource) return res.status(404).json({ error: "Coupon not found" });
    const now = new Date().toISOString();
    await couponsContainer.items.upsert({ ...resource, isActive: false, deletedAt: now, modifiedAt: now });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Admin: verify key (guarded by requireAdmin; 200 = valid, 401 = invalid) ──
serverApp.get("/api/admin/verify", (_req, res) => {
  res.json({ ok: true });
});

// ── Admin: read current prices (in rupees) ──
serverApp.get("/api/admin/prices", async (_req, res) => {
  try {
    const plans = await getEffectivePlans();
    const out: Record<string, number> = {};
    for (const k of Object.keys(plans)) out[k] = Math.round(plans[k].amount / 100);
    res.json(out);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Admin: update prices (body { prices: { "1yr": 899, "2yr": 1299, "ebooks": 949 } } in rupees) ──
serverApp.post("/api/admin/prices", async (req, res) => {
  try {
    const { prices } = req.body || {};
    if (!prices || typeof prices !== "object") {
      return res.status(400).json({ error: "prices object is required" });
    }
    const amounts: Record<string, number> = {};
    for (const k of Object.keys(PLANS)) {
      const rupees = Number(prices[k]);
      if (!Number.isFinite(rupees) || rupees < 1) {
        return res.status(400).json({ error: `Invalid price for ${k} (must be at least ₹1)` });
      }
      amounts[k] = Math.round(rupees * 100);
    }
    await ensureSettingsContainer();
    await settingsContainer.items.upsert({
      id: "plan-prices",
      amounts,
      modifiedAt: new Date().toISOString(),
    });
    res.json({ success: true, amounts });
  } catch (error: any) {
    console.error("set-prices error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// API to update status
serverApp.post("/api/admin/update-status", async (req, res) => {
  const { email, status, durationMonths } = req.body;
  if (!email || !status) {
    return res.status(400).json({ error: "Email and status are required" });
  }

  const userEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();
  const hasCustomDuration = durationMonths !== undefined;
  let customExpiryDate: string | null = null;
  if (hasCustomDuration) {
    const durationNumber = Number(durationMonths);
    if (!Number.isInteger(durationNumber) || durationNumber < 1) {
      return res.status(400).json({
        error: "Duration must be a positive whole number of months",
      });
    }

    const expiry = new Date();
    const originalDay = expiry.getUTCDate();
    expiry.setUTCDate(1);
    expiry.setUTCMonth(expiry.getUTCMonth() + durationNumber);
    if (Number.isNaN(expiry.getTime())) {
      return res.status(400).json({ error: "Duration produces an invalid expiry date" });
    }
    const lastDayOfTargetMonth = new Date(Date.UTC(
      expiry.getUTCFullYear(),
      expiry.getUTCMonth() + 1,
      0
    )).getUTCDate();
    expiry.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
    customExpiryDate = expiry.toISOString();
  }

  try {
    // Check if user already exists
    let existing: any = null;
    try {
      const { resource } = await usersContainer.item(userEmail, userEmail).read();
      existing = resource;
    } catch (e: any) {}

    const expiryDate = customExpiryDate || (
      status === "subscribed"
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : existing?.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    );

    await usersContainer.items.upsert({
      id: userEmail,
      email: userEmail,
      status,
      createdAt: existing?.createdAt || now,
      modifiedAt: now,
      expiryDate,
      isActive: true,
    });
    res.json({ message: "Success", user: { email: userEmail, status, expiryDate } });
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

// Load aggregated study activity when the Admin Portal opens.
serverApp.get("/api/admin/user-usage", async (_req, res) => {
  try {
    const { resources } = await userQuestionsContainer.items
      .query(
        "SELECT c.userId, c.questionId, c.questionType, c.exam, c.isBookmarked, c.hasNote, c.attemptCount, c.correctCount, c.wrongCount FROM c WHERE c.isActive = true"
      )
      .fetchAll();

    const [prelimsQuestions, csatResult, englishResult] = await Promise.all([
      getQuestions(),
      csatQuestionsContainer.items.readAll({ maxItemCount: -1 }).fetchAll(),
      englishQuestionsContainer.items.readAll({ maxItemCount: -1 }).fetchAll(),
    ]);
    const examByQuestion = new Map<string, string>();
    for (const [type, questions] of [
      ["prelims", prelimsQuestions],
      ["csat", csatResult.resources],
      ["english", englishResult.resources],
    ] as const) {
      for (const question of questions) {
        if (question?.id === undefined || question?.id === null || !question?.exam) continue;
        examByQuestion.set(`${type}:${String(question.id)}`, String(question.exam));
      }
    }

    const usageByEmail: Record<string, {
      bookmarks: number;
      notes: number;
      attempts: number;
      correct: number;
      wrong: number;
      topExam: string | null;
      topExamAttempts: number;
      examBreakdown: { exam: string; attempts: number }[];
    }> = {};
    const userExamAttempts: Record<string, Record<string, number>> = {};
    const examAttempts: Record<string, number> = {};
    const examUsers: Record<string, Set<string>> = {};
    for (const item of resources) {
      const email = String(item.userId || "").toLowerCase().trim();
      if (!email) continue;
      const totals = usageByEmail[email] ||= { bookmarks: 0, notes: 0, attempts: 0, correct: 0, wrong: 0, topExam: null, topExamAttempts: 0, examBreakdown: [] };
      const attempts = Number(item.attemptCount) || 0;
      if (item.isBookmarked === true) totals.bookmarks += 1;
      if (item.hasNote === true) totals.notes += 1;
      totals.attempts += attempts;
      totals.correct += Number(item.correctCount) || 0;
      totals.wrong += Number(item.wrongCount) || 0;
      const questionType = String(item.questionType || "prelims").trim() || "prelims";
      const resolvedExam = String(item.exam || "").trim()
        || examByQuestion.get(`${questionType}:${String(item.questionId)}`)
        || "";
      const exam = getExamCategory(resolvedExam);
      if (attempts > 0) {
        const userExams = userExamAttempts[email] ||= {};
        userExams[exam] = (userExams[exam] || 0) + attempts;
        examAttempts[exam] = (examAttempts[exam] || 0) + attempts;
        (examUsers[exam] ||= new Set()).add(email);
      }
    }

    for (const [email, exams] of Object.entries(userExamAttempts)) {
      const breakdown = Object.entries(exams)
        .map(([exam, attempts]) => ({ exam, attempts }))
        .sort((a, b) => b.attempts - a.attempts);
      usageByEmail[email].examBreakdown = breakdown;
      const topExam = breakdown[0];
      if (topExam) {
        usageByEmail[email].topExam = topExam.exam;
        usageByEmail[email].topExamAttempts = topExam.attempts;
      }
    }

    const exams = Object.entries(examAttempts)
      .map(([exam, attempts]) => ({ exam, attempts, users: examUsers[exam]?.size || 0 }))
      .sort((a, b) => b.attempts - a.attempts);

    res.json({ users: usageByEmail, exams });
  } catch (error: any) {
    console.error("Error fetching admin usage dashboard:", error);
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

// ============ FEEDBACK ENDPOINTS ============

// Submit feedback — global (questionId null) or tied to a specific question.
serverApp.post("/api/feedback", async (req, res) => {
  try {
    const { questionId, questionType, comment, userAlias } = req.body || {};
    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ error: "Feedback comment is required" });
    }
    await ensureFeedbackContainer();
    const now = new Date().toISOString();
    const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id,
      questionId: questionId ?? null,
      questionType: (questionType && String(questionType).trim()) || "global",
      comment: String(comment).trim().slice(0, 2000),
      userAlias: (userAlias && String(userAlias).trim().slice(0, 120)) || "Anonymous",
      createdAt: now,
    };
    await feedbackContainer.items.create(item);
    res.json({ success: true, feedback: item });
  } catch (error: any) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Admin: list all feedback (most recent first).
serverApp.get("/api/admin/feedback", async (_req, res) => {
  try {
    await ensureFeedbackContainer();
    const { resources } = await feedbackContainer.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 500")
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Admin: list all payments (most recent first).
serverApp.get("/api/admin/payments", async (_req, res) => {
  try {
    await ensurePaymentsContainer();
    const { resources } = await paymentsContainer.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 500")
      .fetchAll();
    res.json(resources);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
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

// ── Per-user attempts: append one answered question, grouped by attemptId ──
serverApp.post("/api/attempts", async (req, res) => {
  try {
    const { email, questionId, questionType, option, isCorrect, attemptId, subject, topic, exam, year, timeSpentMs } = req.body || {};
    const userEmail = String(email || "").toLowerCase().trim();
    if (!userEmail || questionId === undefined || questionId === null) {
      return res.status(400).json({ error: "email and questionId are required" });
    }
    const type = (questionType && String(questionType).trim()) || "prelims";
    await ensureUserQuestionsContainer();
    await appendAttempt(
      userEmail,
      type,
      questionId,
      {
        attemptId: (attemptId && String(attemptId)) || "legacy",
        option: option ?? null,
        isCorrect: !!isCorrect,
        timeSpentMs: Number.isFinite(timeSpentMs) ? Number(timeSpentMs) : null,
        ts: new Date().toISOString(),
      },
      {
        subject: (subject && String(subject).trim()) || null,
        topic: (topic && String(topic).trim()) || null,
        exam: (exam && String(exam).trim()) || null,
        year: (year && String(year).trim()) || null,
      }
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving attempt:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Per-user attempts: fetch saved attempts + score (overall, per section, attempt count) ──
serverApp.get("/api/attempts", async (req, res) => {
  try {
    const userEmail = String(req.query.email || "").toLowerCase().trim();
    if (!userEmail) return res.status(400).json({ error: "email is required" });
    await ensureUserQuestionsContainer();
    // Projection only: the (unindexed) attempts array is never pulled back, so
    // the report stays cheap no matter how long a user's history grows.
    const { resources } = await userQuestionsContainer.items
      .query(
        {
          query:
            "SELECT c.questionId, c.questionType, c.lastOption, c.lastIsCorrect, c.lastAttemptId, c.lastAttemptAt, c.subject, c.topic, c.attemptCount, c.correctCount, c.wrongCount FROM c WHERE c.isActive = true AND c.attemptCount > 0",
        },
        { partitionKey: userEmail }
      )
      .fetchAll();
    const sections: Record<string, { correct: number; total: number }> = {};
    const subjects: Record<string, { correct: number; total: number }> = {};
    const topics: Record<string, { correct: number; total: number; subject: string | null }> = {};
    let correct = 0;
    let latestAttemptId: string | null = null;
    let latestTs = "";
    const attemptSet = new Set<string>();
    // Scores reflect the latest attempt per question, matching how the app
    // displays a question's state; correctCount/wrongCount carry lifetime totals.
    const attempts = resources.map((a: any) => ({
      questionId: a.questionId,
      questionType: a.questionType,
      option: a.lastOption ?? null,
      isCorrect: !!a.lastIsCorrect,
      attemptId: a.lastAttemptId ?? null,
      subject: a.subject ?? null,
      topic: a.topic ?? null,
      ts: a.lastAttemptAt ?? null,
      attemptCount: a.attemptCount ?? 0,
      correctCount: a.correctCount ?? 0,
      wrongCount: a.wrongCount ?? 0,
    }));
    for (const a of attempts) {
      const t = a.questionType || "prelims";
      if (!sections[t]) sections[t] = { correct: 0, total: 0 };
      sections[t].total += 1;
      if (a.isCorrect) { sections[t].correct += 1; correct += 1; }
      if (a.subject) {
        if (!subjects[a.subject]) subjects[a.subject] = { correct: 0, total: 0 };
        subjects[a.subject].total += 1;
        if (a.isCorrect) subjects[a.subject].correct += 1;
      }
      if (a.topic) {
        if (!topics[a.topic]) topics[a.topic] = { correct: 0, total: 0, subject: a.subject || null };
        topics[a.topic].total += 1;
        if (a.isCorrect) topics[a.topic].correct += 1;
      }
      if (a.attemptId) attemptSet.add(a.attemptId);
      if (a.ts && a.ts > latestTs) { latestTs = a.ts; latestAttemptId = a.attemptId || null; }
    }
    res.json({
      attempts,
      score: { correct, total: attempts.length },
      sections,
      subjects,
      topics,
      attemptCount: attemptSet.size,
      latestAttemptId,
    });
  } catch (error: any) {
    console.error("Error fetching attempts:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Per-user question state: list bookmarks / notes / revision marks ──
serverApp.get("/api/question-state", async (req, res) => {
  try {
    const userEmail = String(req.query.email || "").toLowerCase().trim();
    if (!userEmail) return res.status(400).json({ error: "email is required" });
    await ensureUserQuestionsContainer();
    const { resources } = await userQuestionsContainer.items
      .query(
        {
          query:
            "SELECT c.questionId, c.questionType, c.isBookmarked, c.isMarkedForRevision, c.notes, c.hasNote, c.subject, c.topic, c.exam, c.year, c.attemptCount, c.correctCount, c.wrongCount, c.lastOption, c.lastIsCorrect, c.lastAttemptAt, c.updatedAt FROM c WHERE c.isActive = true AND (c.isBookmarked = true OR c.hasNote = true OR c.isMarkedForRevision = true OR c.attemptCount > 0) ORDER BY c.updatedAt DESC",
        },
        { partitionKey: userEmail }
      )
      .fetchAll();
    res.json({ items: resources });
  } catch (error: any) {
    console.error("Error fetching question state:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Per-user question state: full attempt history for a single question ──
// A point read (~1 RU) keeps the unindexed `attempts` array out of the list
// endpoint, so it is only paid for when a user actually asks to see it.
serverApp.get("/api/question-attempts", async (req, res) => {
  try {
    const userEmail = String(req.query.email || "").toLowerCase().trim();
    const questionId = req.query.questionId;
    if (!userEmail || questionId === undefined) {
      return res.status(400).json({ error: "email and questionId are required" });
    }
    const type = String(req.query.questionType || "prelims").trim() || "prelims";
    await ensureUserQuestionsContainer();

    let doc: any = null;
    try {
      const { resource } = await userQuestionsContainer.item(`${type}:${questionId}`, userEmail).read();
      doc = resource;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    if (!doc || doc.isActive === false) {
      return res.json({ attempts: [], attemptCount: 0, correctCount: 0, wrongCount: 0 });
    }

    // Newest first: the stored array is append-ordered.
    const attempts = [...(doc.attempts || [])].reverse();
    res.json({
      attempts,
      attemptCount: doc.attemptCount ?? attempts.length,
      correctCount: doc.correctCount ?? 0,
      wrongCount: doc.wrongCount ?? 0,
    });
  } catch (error: any) {
    console.error("Error fetching question attempts:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Per-user question state: save a bookmark, note or revision mark ──
serverApp.post("/api/question-state", async (req, res) => {
  try {
    const { email, questionId, questionType, isBookmarked, notes, isMarkedForRevision, subject, topic, exam, year } =
      req.body || {};
    const userEmail = String(email || "").toLowerCase().trim();
    if (!userEmail || questionId === undefined || questionId === null) {
      return res.status(400).json({ error: "email and questionId are required" });
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > 5000)) {
      return res.status(400).json({ error: "notes must be a string of at most 5000 characters" });
    }
    const type = (questionType && String(questionType).trim()) || "prelims";
    await ensureUserQuestionsContainer();
    const doc = await updateQuestionState(
      userEmail,
      type,
      questionId,
      {
        isBookmarked: isBookmarked === undefined ? undefined : !!isBookmarked,
        notes,
        isMarkedForRevision: isMarkedForRevision === undefined ? undefined : !!isMarkedForRevision,
      },
      {
        subject: (subject && String(subject).trim()) || null,
        topic: (topic && String(topic).trim()) || null,
        exam: (exam && String(exam).trim()) || null,
        year: (year && String(year).trim()) || null,
      }
    );
    res.json({
      success: true,
      isBookmarked: doc.isBookmarked,
      hasNote: doc.hasNote,
      isMarkedForRevision: doc.isMarkedForRevision,
    });
  } catch (error: any) {
    console.error("Error saving question state:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ── Per-user question state: soft delete (never removes the document) ──
serverApp.delete("/api/question-state", async (req, res) => {
  try {
    const userEmail = String(req.query.email || "").toLowerCase().trim();
    const questionId = req.query.questionId;
    if (!userEmail || questionId === undefined) {
      return res.status(400).json({ error: "email and questionId are required" });
    }
    const type = String(req.query.questionType || "prelims").trim() || "prelims";
    await ensureUserQuestionsContainer();
    await updateQuestionState(
      userEmail,
      type,
      questionId,
      { isActive: false },
      { subject: null, topic: null, exam: null, year: null }
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting question state:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default serverApp;
