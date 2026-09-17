/**
 * Layer 0 remediation.
 *
 *  1. Repairs answers stored as a bare option label ("(b)") by expanding them to
 *     the full option text.
 *  2. Flags every remaining structural defect with `needsReview` + `reviewCodes`
 *     so broken questions can be filtered out of the app until a human fixes them.
 *
 * Dry-run by default; pass --apply to write. Nothing is deleted; prior values are
 * recorded under `correction`.
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const db = client.database(process.env.COSMOS_DATABASE || "pyqpowerhouse");
const CONTAINERS = ["questions", "state_pcs", "csat-questions", "english-questions"];

const stripTags = (s) => String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
const squash = (s) => stripTags(s).replace(/\s+/g, " ").trim();
const alnum = (s) => stripTags(s).replace(/[^a-z0-9]/gi, "").toLowerCase();
const LABEL_RE = /^\s*\(?\s*([a-eA-E]|[1-5])\s*\)?\s*[.)\]:-]?\s+/;
const optionLabel = (s) => {
  const m = String(s ?? "").match(LABEL_RE);
  return m ? m[1].toLowerCase() : null;
};
const optionBody = (s) => alnum(String(s ?? "").replace(LABEL_RE, ""));

function maxStatementRef(options) {
  let max = 0;
  for (const o of options ?? []) {
    const b = String(o).replace(LABEL_RE, "");
    for (const m of b.matchAll(/\b([1-9])\b/g)) max = Math.max(max, Number(m[1]));
    for (const m of b.matchAll(/\b(IV|V|I{1,3})\b/g)) max = Math.max(max, { I: 1, II: 2, III: 3, IV: 4, V: 5 }[m[1]] || 0);
  }
  return max;
}
function statementsInQuestion(question) {
  const t = stripTags(question);
  const nums = new Set();
  for (const m of t.matchAll(/(?:^|\n)\s*\(?\s*([1-9])\s*[.)]\s+\S/g)) nums.add(Number(m[1]));
  for (const m of t.matchAll(/(?:^|\n)\s*\(?\s*(IV|V|I{1,3})\s*[.)]\s+\S/g)) nums.add({ I: 1, II: 2, III: 3, IV: 4, V: 5 }[m[1]] || 0);
  return nums.size ? Math.max(...nums) : 0;
}

const REVIEW_TEXT = {
  ANSWER_NOT_IN_OPTIONS: "Stored answer does not match any option.",
  ANSWER_LABEL_MISMATCH: "Answer text matches an option with a different letter - verify which is intended.",
  MATCHLIST_NO_LIST2: "'Match List' question is missing List-II.",
  STATEMENT_MISSING: "Options reference a statement number that is not present in the question.",
  OPTION_DUPLICATE: "Two options are textually identical.",
  OPTIONS_MISSING: "Fewer than two options stored.",
  OPTION_BLANK: "At least one option is empty.",
  QUESTION_EMPTY: "Question body is empty.",
  ANSWER_EMPTY: "No answer stored.",
};

const pkCache = new Map();
async function pkPath(name) {
  if (!pkCache.has(name)) {
    const { resource } = await db.container(name).read();
    pkCache.set(name, resource.partitionKey.paths[0].replace(/^\//, ""));
  }
  return pkCache.get(name);
}

let expanded = 0;
let flagged = 0;
let cleared = 0;
const samples = [];

for (const name of CONTAINERS) {
  const container = db.container(name);
  const { resources } = await container.items.query("SELECT * FROM c").fetchAll();
  const pk = await pkPath(name);

  for (const doc of resources) {
    const opts = Array.isArray(doc.options) ? doc.options : null;
    const answer = String(doc.answer ?? "").trim();
    const codes = [];
    const previous = {};
    let dirty = false;

    // ---- repair: answer stored as a bare label ----
    if (opts && opts.length >= 2 && /^\(?\s*[a-eA-E1-5]\s*\)?\s*[.)]?\s*$/.test(answer)) {
      const want = answer.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const hit = opts.find((o) => optionLabel(o) === want);
      if (hit) {
        previous.answer = doc.answer;
        doc.answer = hit;
        dirty = true;
        expanded += 1;
        if (samples.length < 8) samples.push(`  ${doc.id}: ${JSON.stringify(answer)} -> ${JSON.stringify(String(hit).slice(0, 44))}`);
      }
    }

    const finalAnswer = String(doc.answer ?? "").trim();

    // ---- detect remaining defects ----
    if (!squash(doc.question)) codes.push("QUESTION_EMPTY");
    if (!opts || opts.length < 2) codes.push("OPTIONS_MISSING");
    else {
      if (opts.some((o) => !String(o ?? "").trim())) codes.push("OPTION_BLANK");
      const bodies = opts.map(alnum);
      if (new Set(bodies).size !== bodies.length) codes.push("OPTION_DUPLICATE");
      if (!finalAnswer) codes.push("ANSWER_EMPTY");
      else if (!opts.some((o) => alnum(o) === alnum(finalAnswer))) {
        const twin = opts.find((o) => optionBody(o) && optionBody(o) === optionBody(finalAnswer));
        codes.push(twin ? "ANSWER_LABEL_MISMATCH" : "ANSWER_NOT_IN_OPTIONS");
      }
      const refMax = maxStatementRef(opts);
      const stmt = statementsInQuestion(doc.question);
      if (refMax >= 2 && stmt >= 2 && refMax > stmt) codes.push("STATEMENT_MISSING");
    }
    const qt = squash(doc.question);
    if (/match\s+list/i.test(qt) && !/list\s*-?\s*(ii|2|b)/i.test(qt)) codes.push("MATCHLIST_NO_LIST2");

    const shouldFlag = codes.length > 0;
    const wasFlagged = doc.needsReview === true;

    if (shouldFlag) {
      const note = codes.map((c) => REVIEW_TEXT[c] || c).join(" ");
      if (!wasFlagged || JSON.stringify(doc.reviewCodes) !== JSON.stringify(codes)) {
        if (!wasFlagged) previous.needsReview = doc.needsReview ?? null;
        doc.needsReview = true;
        doc.reviewCodes = codes;
        doc.reviewNote = note;
        dirty = true;
        flagged += 1;
      }
    } else if (wasFlagged && Array.isArray(doc.reviewCodes)) {
      // previously auto-flagged, now clean
      previous.needsReview = true;
      doc.needsReview = false;
      doc.reviewCodes = [];
      dirty = true;
      cleared += 1;
    }

    if (!dirty) continue;
    if (Object.keys(previous).length) {
      const hist = Array.isArray(doc.correction) ? doc.correction : doc.correction ? [doc.correction] : [];
      hist.push({ at: new Date().toISOString(), reason: "structural audit (layer 0)", source: "audit-questions", previous });
      doc.correction = hist;
    }
    if (APPLY) await container.item(doc.id, doc[pk]).replace(doc);
  }
  console.log(`processed ${name}`);
}

console.log("\nbare-label answers expanded :", expanded);
samples.forEach((s) => console.log(s));
console.log("documents flagged needsReview:", flagged);
console.log("previously flagged, now clean:", cleared);
console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}${APPLY ? "" : " - re-run with --apply to write."}`);
