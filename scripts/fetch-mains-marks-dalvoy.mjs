/**
 * Second pass for Mains questions still missing `marks` / `words`.
 *
 * Source: dalvoy's archive of the official papers. Each paper has a JSON-LD
 * question list, and each question page prints the paper's own "10 Marks
 * 150 Words" line. Only those two numbers are read; question text in the DB
 * is never replaced.
 *
 * Usage: node scripts/fetch-mains-marks-dalvoy.mjs [--apply]
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const CACHE = path.join("scripts", ".cache", "dalvoy");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const ROMAN = { GS1: "i", GS2: "ii", GS3: "iii", GS4: "iv" };

async function getPage(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, Buffer.from(url).toString("base64url").slice(-120) + ".html");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const html = res.ok ? await res.text() : "";
  fs.writeFileSync(file, html);
  await new Promise(r => setTimeout(r, 350)); // be polite to the source
  return html;
}

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = s => new Set(norm(s).split(" ").filter(w => w.length > 3));
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const container = client
  .database(process.env.COSMOS_DATABASE || "pyqpowerhouse")
  .container("mains-questions");

const { resources: docs } = await container.items.query("SELECT * FROM c").fetchAll();
const missing = docs.filter(d => d.marks == null || d.words == null);
console.log(`still missing: ${missing.length}`);

const groups = new Map();
for (const d of missing) {
  const key = `${d.year}|${d.paper || ""}`;
  (groups.get(key) || groups.set(key, []).get(key)).push(d);
}

let filled = 0, noList = 0, noMatch = 0, noNumbers = 0, adjusted = 0;
const samples = [];

for (const [key, list] of groups) {
  const [year, paper] = key.split("|");
  if (!ROMAN[paper]) { noList += list.length; continue; }

  const listUrl = `https://www.dalvoy.com/en/upsc/mains/previous-years/${year}/general-studies-paper-${ROMAN[paper]}`;
  const html = await getPage(listUrl);
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) { noList += list.length; continue; }

  let items = [];
  try {
    items = (JSON.parse(m[1]).mainEntity?.itemListElement || [])
      .map(x => ({ text: x.item?.text || "", url: x.item?.url || "" }))
      .filter(x => x.text && x.url);
  } catch { /* malformed JSON-LD — treat as no list */ }
  if (!items.length) { noList += list.length; continue; }

  for (const doc of list) {
    const dt = tokens(doc.questionRaw || doc.question);
    let best = null, second = 0;
    for (const cand of items) {
      const score = dice(dt, tokens(cand.text));
      if (!best || score > best.score) { second = best ? best.score : second; best = { ...cand, score }; }
      else if (score > second) second = score;
    }
    if (!best || best.score < 0.55 || best.score - second < 0.08) { noMatch++; continue; }

    const qHtml = await getPage(best.url);
    const plain = qHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const mm = /(\d{1,3}(?:\.\d)?)\s*Marks\s+(\d{2,4})\s*Words/i.exec(plain);
    if (!mm) { noNumbers++; continue; }

    const marks = Number(mm[1]);
    const words = Number(mm[2]);
    if (!(marks >= 5 && marks <= 250) || !(words >= 50 && words <= 2000)) { noNumbers++; continue; }

    // UPSC only ever pairs certain marks with certain word limits. A pair the
    // papers never used means the source mis-transcribed one of the two, so
    // trust the word limit (which drives the pair) and recompute the marks.
    const VALID = new Set(["5|100", "10|150", "12.5|200", "15|250", "20|250", "25|250", "125|1000", "125|1250"]);
    const BY_WORDS = { 100: 5, 150: 10, 200: 12.5, 250: 15 };
    let finalMarks = marks;
    let source = "dalvoy";
    if (!VALID.has(`${marks}|${words}`)) {
      // GS4 legitimately uses both 15 and 20 marks at 250 words, so a bad pair
      // there cannot be resolved safely.
      if (paper === "GS4" || !BY_WORDS[words]) { noNumbers++; continue; }
      finalMarks = BY_WORDS[words];
      source = "dalvoy-corrected";
      adjusted++;
    }

    const next = {
      ...doc,
      marks: doc.marks ?? finalMarks,
      words: doc.words ?? words,
      marksSource: source,
      modifiedAt: new Date().toISOString(),
    };
    for (const k of ["_rid", "_self", "_etag", "_attachments", "_ts"]) delete next[k];

    if (samples.length < 8) samples.push(`${year} ${paper} ${finalMarks}m/${words}w score=${best.score.toFixed(2)} ${norm(doc.question).slice(0, 65)}`);
    filled++;
    if (APPLY) await container.items.upsert(next);
  }
}

console.log({ filled, adjusted, noList, noMatch, noNumbers, applied: APPLY });
console.log(samples.join("\n"));
if (!APPLY) console.log("\nDry run only. Re-run with --apply to write.");
