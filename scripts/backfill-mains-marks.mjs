/**
 * Backfill `marks` and `words` on mains-questions from the word limit that is
 * already embedded in the question text, e.g. "... (150w)" or "(10m, 150 words)".
 *
 * The trailing hint is removed from `question` so the card does not show the
 * limit twice once the pills render it. The original text is kept in
 * `questionRaw` so nothing is lost and the change can be reversed.
 *
 * Usage:  node scripts/backfill-mains-marks.mjs [--apply]
 * Without --apply it only reports what would change.
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const container = client
  .database(process.env.COSMOS_DATABASE || "pyqpowerhouse")
  .container("mains-questions");

// Standard UPSC mapping. 200-word questions were the 2014-2016 12.5-mark format.
const MARKS_FOR_WORDS = { 150: 10, 200: 12.5, 250: 15, 1000: 125, 1250: 125 };

// One trailing bracket that mentions a word count, optionally with the marks.
const TRAILING = /\s*[([]\s*(?:(\d{1,3})\s*m(?:arks?)?\s*[,/]?\s*)?(\d{2,4})\s*(?:w|words?)\s*(?:[,/]\s*(\d{1,3})\s*m(?:arks?)?\s*)?[)\]]\s*\.?\s*$/i;

const { resources } = await container.items.query("SELECT * FROM c").fetchAll();

let changed = 0;
let alreadyOk = 0;
let noHint = 0;
const samples = [];

for (const doc of resources) {
  const text = String(doc.question || "").trim();
  const m = TRAILING.exec(text);
  if (!m) {
    if (doc.words != null) alreadyOk++;
    else noHint++;
    continue;
  }

  const words = Number(m[2]);
  const marks = Number(m[1] || m[3]) || MARKS_FOR_WORDS[words] || null;
  const cleaned = text.slice(0, m.index).trim();

  // Nothing to do if the fields already match and the text is already clean.
  if (doc.words === words && doc.marks === marks) {
    alreadyOk++;
    continue;
  }

  const updated = {
    ...doc,
    question: cleaned || text,
    questionRaw: doc.questionRaw ?? text,
    words,
    marks,
    modifiedAt: new Date().toISOString(),
  };
  delete updated._rid;
  delete updated._self;
  delete updated._etag;
  delete updated._attachments;
  delete updated._ts;

  if (samples.length < 6) {
    samples.push(`${doc.year} ${doc.paper || "-"} → ${marks}m / ${words}w :: ${cleaned.slice(0, 80)}`);
  }
  changed++;
  if (APPLY) await container.items.upsert(updated);
}

console.log({ total: resources.length, changed, alreadyOk, noHint, applied: APPLY });
console.log(samples.join("\n"));
if (!APPLY) console.log("\nDry run only. Re-run with --apply to write.");
