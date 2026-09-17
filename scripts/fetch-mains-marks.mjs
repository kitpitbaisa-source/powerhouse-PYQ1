/**
 * Fills in `marks` and `words` for Mains questions that don't have them.
 *
 * upsc.gov.in serves a catch-all page to non-browser clients, so the source
 * used here is iasexamportal's transcription of the official papers, which
 * carries the paper's own "(Answer in 150 words) 10 Marks" markers. Only the
 * marks and word limit are taken; question text in the DB is never replaced.
 *
 * Matching is per year + paper, by token similarity, and a question is only
 * updated when the best match is both strong and clearly ahead of the runner-up.
 *
 * Usage: node scripts/fetch-mains-marks.mjs [--apply]
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const CACHE = path.join("scripts", ".cache", "mains-papers");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const MARKS_FOR_WORDS = { 100: 5, 150: 10, 200: 12.5, 250: 15 };

// Source pages, English only. Slugs changed shape over the years.
const SOURCES = [];
for (let y = 2017; y <= 2025; y++)
  for (let p = 1; p <= 4; p++)
    SOURCES.push({ year: String(y), paper: `GS${p}`, url: `https://iasexamportal.com/upsc-mains/papers/${y}-general-studies-paper-${p}` });
for (const y of [2015, 2016])
  for (let p = 1; p <= 4; p++)
    SOURCES.push({ year: String(y), paper: `GS${p}`, url: `https://iasexamportal.com/ias-mains/papers/${y}/general-studies-paper-${p}` });
for (const y of [2013, 2014])
  for (let p = 1; p <= 4; p++)
    SOURCES.push({ year: String(y), paper: `GS${p}`, url: `https://iasexamportal.com/ias-mains/papers/${y}-general-studies-paper-${p}` });
SOURCES.push({ year: "2014", paper: "GS3", url: "https://iasexamportal.com/ias-mains/download-general-studies-paper-3-2014" });
SOURCES.push({ year: "2014", paper: "GS4", url: "https://iasexamportal.com/ias-mains/download-general-studies-paper-4-2014" });

async function getPage(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, encodeURIComponent(url).slice(-120) + ".html");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const html = res.ok ? await res.text() : "";
  fs.writeFileSync(file, html);
  await new Promise(r => setTimeout(r, 400)); // be polite to the source
  return html;
}

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " \n ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ");
}

// Each marker closes a question; the text before it (back to the previous
// marker) is that question. Papers use several forms:
//   "(Answer in 150 words) 10 Marks"   "(150 words)"
//   "(12.5M)"   "12.5 marks"   "(10 Marks)"
// When only marks are given, the word limit comes from the paper's own
// instruction line ("not more than 200 words") or the standard mapping.
const MARKER = /\(\s*(?:answer\s+in\s+)?(\d{2,4})\s*words?\s*\)\s*\|?\s*(?:(\d{1,3}(?:\.\d)?)\s*marks?)?|\(?\s*(\d{1,3}(?:\.\d)?)\s*(?:M\b|marks?\b)\s*\)?|\(\s*(10|12\.5|15|20|25)\s*\)/gi;

const WORDS_FOR_MARKS = { 10: 150, 12.5: 200, 15: 250, 20: 250, 25: 250 };

function extract(text) {
  // Paper-level default, e.g. "answer ... in not more than 200 words each".
  const instr = /not\s+more\s+than\s+(\d{2,4})\s*words/i.exec(text);
  const paperWords = instr ? Number(instr[1]) : null;

  const out = [];
  let last = 0;
  for (const m of text.matchAll(MARKER)) {
    let words = m[1] ? Number(m[1]) : null;
    let marks = Number(m[2] || m[3] || m[4]) || null;
    if (words == null && marks != null) words = paperWords || WORDS_FOR_MARKS[marks] || null;
    if (marks == null && words != null) marks = MARKS_FOR_WORDS[words] || null;
    if (words == null || words < 50 || words > 2000) continue;
    if (marks != null && (marks < 5 || marks > 250)) continue;

    const body = text.slice(last, m.index).trim();
    last = m.index + m[0].length;
    out.push({ question: body, words, marks });
  }
  return out;
}

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = s => new Set(norm(s).split(" ").filter(w => w.length > 3));

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

// ── Load the DB side ──
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const container = client
  .database(process.env.COSMOS_DATABASE || "pyqpowerhouse")
  .container("mains-questions");

const { resources: docs } = await container.items.query("SELECT * FROM c").fetchAll();
const needing = docs.filter(d => d.words == null || d.marks == null);
console.log(`docs=${docs.length} needing marks/words=${needing.length}`);

// ── Scrape ──
const scraped = new Map(); // "year|paper" -> [{question, words, marks}]
for (const s of SOURCES) {
  const html = await getPage(s.url);
  if (!html) continue;
  const items = extract(toText(html)).filter(x => x.question.length > 40);
  if (!items.length) continue;
  const key = `${s.year}|${s.paper}`;
  const prev = scraped.get(key) || [];
  scraped.set(key, prev.length >= items.length ? prev : items);
}
console.log("scraped papers:", scraped.size, "questions:", [...scraped.values()].reduce((n, a) => n + a.length, 0));

// ── Match and update ──
let updated = 0, ambiguous = 0, nomatch = 0;
const samples = [];
const missByPaper = {};

for (const doc of needing) {
  const key = `${doc.year}|${doc.paper || ""}`;
  // Fall back to every paper of that year when the doc has no paper set.
  const pool = scraped.get(key) || [...scraped].filter(([k]) => k.startsWith(`${doc.year}|`)).flatMap(([, v]) => v);
  if (!pool.length) { nomatch++; missByPaper[key] = (missByPaper[key] || 0) + 1; continue; }

  const dt = tokens(doc.questionRaw || doc.question);
  let best = null, second = 0;
  for (const cand of pool) {
    const score = dice(dt, tokens(cand.question));
    if (!best || score > best.score) { second = best ? best.score : second; best = { ...cand, score }; }
    else if (score > second) second = score;
  }
  if (!best || best.score < 0.55) { nomatch++; missByPaper[key] = (missByPaper[key] || 0) + 1; continue; }
  if (best.score - second < 0.08) { ambiguous++; continue; }

  const next = {
    ...doc,
    words: doc.words ?? best.words,
    marks: doc.marks ?? best.marks,
    marksSource: "iasexamportal",
    modifiedAt: new Date().toISOString(),
  };
  for (const k of ["_rid", "_self", "_etag", "_attachments", "_ts"]) delete next[k];

  if (samples.length < 8) {
    samples.push(`${doc.year} ${doc.paper} ${best.marks}m/${best.words}w  score=${best.score.toFixed(2)}  ${norm(doc.question).slice(0, 70)}`);
  }
  updated++;
  if (APPLY) await container.items.upsert(next);
}

console.log({ updated, ambiguous, nomatch, applied: APPLY });
console.log("unmatched by year|paper:", missByPaper);
console.log(samples.join("\n"));

// ── Pass 2: papers that state a uniform rule in their own instructions ──
// e.g. "Answer ... in NOT MORE THAN 200 words each ... All questions carry
// equal marks." Marks per question = 250 / number of questions on the paper.
// Only papers that actually print such an instruction are touched.
const uniform = new Map(); // "year|paper" -> { words, marks }
for (const s of SOURCES) {
  const html = await getPage(s.url);
  if (!html) continue;
  const text = toText(html).replace(/\s+/g, " ");
  const w = /not\s+more\s+than\s+(\d{2,4})\s*words/i.exec(text);
  if (!w) continue;
  const stated = /each\s+question\s+carries\s+(\d{1,3}(?:\.\d)?)\s*marks/i.exec(text);
  const equal = /(?:all\s+questions?\s+carry|each\s+question\s+carries)\s+equal\s+marks/i.test(text);
  let marks = stated ? Number(stated[1]) : null;
  if (marks == null && equal) {
    const count = [...text.matchAll(/(?:^|\s)(\d{1,2})\.\s+[A-Z(]/g)].map(m => Number(m[1]));
    const n = count.length ? Math.max(...count) : 0;
    if (n >= 10 && n <= 30) marks = Math.round((250 / n) * 10) / 10;
  }
  if (marks == null) continue;
  uniform.set(`${s.year}|${s.paper}`, { words: Number(w[1]), marks });
}

let uniformApplied = 0;
const uniformLog = [];
for (const doc of docs) {
  if (doc.words != null && doc.marks != null) continue;
  const rule = uniform.get(`${doc.year}|${doc.paper || ""}`);
  if (!rule) continue;
  const next = {
    ...doc,
    words: doc.words ?? rule.words,
    marks: doc.marks ?? rule.marks,
    marksSource: "paper-instruction",
    modifiedAt: new Date().toISOString(),
  };
  for (const k of ["_rid", "_self", "_etag", "_attachments", "_ts"]) delete next[k];
  uniformApplied++;
  if (APPLY) await container.items.upsert(next);
}
for (const [k, v] of uniform) uniformLog.push(`${k} → ${v.marks}m / ${v.words}w`);
console.log(`\nuniform-rule papers (${uniform.size}):\n` + uniformLog.join("\n"));
console.log("filled by uniform rule:", uniformApplied);

if (!APPLY) console.log("\nDry run only. Re-run with --apply to write.");
