/**
 * Layer 0 + Layer 1 question-bank audit. READ ONLY - never writes to Cosmos.
 *
 *   node scripts/audit-questions.mjs [--json <path>]
 *
 * Layer 0 (structural): defects detectable without understanding the question.
 * Layer 1 (contradiction): the stored explanation argues for a different answer
 *          than the stored answer, or still contains model deliberation.
 */
import "dotenv/config";
import fs from "fs";
import { CosmosClient } from "@azure/cosmos";

const jsonFlag = process.argv.indexOf("--json");
const JSON_OUT = jsonFlag !== -1 ? process.argv[jsonFlag + 1] : null;

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const db = client.database(process.env.COSMOS_DATABASE || "pyqpowerhouse");
const CONTAINERS = ["questions", "state_pcs", "csat-questions", "english-questions"];

const stripTags = (s) => String(s ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
const squash = (s) => stripTags(s).replace(/\s+/g, " ").trim();
const alnum = (s) => stripTags(s).replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Leading option label: "(b) ..." | "B. ..." | "(2) ..." -> "b" / "2" */
function optionLabel(text) {
  const m = String(text ?? "").match(/^\s*\(?\s*([a-dA-D]|[1-4])\s*\)?\s*[.)\]:-]?\s+/);
  return m ? m[1].toLowerCase() : null;
}

/** Option letters the explanation explicitly asserts as the answer. */
function assertedLetters(explanation) {
  const text = stripTags(explanation);
  const found = new Set();
  const patterns = [
    /option\s*\(?\s*([a-d])\s*\)?\s*(?:is|was)?\s*(?:the\s*)?correct/gi,
    /correct\s*(?:option|answer|choice)\s*(?:is|:)\s*\(?\s*([a-d])\s*\)?/gi,
    /answer\s*(?:is|:)\s*\(?\s*([a-d])\s*\)?\s*(?![a-z0-9])/gi,
    /hence[,\s]*\(?\s*([a-d])\s*\)?\s*(?:is|$)/gi,
    /\bso\s*,?\s*option\s*\(?\s*([a-d])\s*\)?/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) found.add(m[1].toLowerCase());
  }
  return [...found];
}

const DELIBERATION =
  /\b(let'?s\s+(check|re-?check|verify|see)|let\s+me\s+(check|re-?check|verify)|wait,|hmm+\b|actually,\s*(check|the|it|this)|i\s+think\s+the\s+answer|re-?check(ing)?\s*:|on\s+second\s+thought|but\s+the\s+specific\s+figure\s+tested)/i;

/** Highest statement number the option strings refer to, e.g. "(b) 2, 3 and 4" -> 4 */
function maxStatementRef(options) {
  let max = 0;
  for (const o of options ?? []) {
    const body = String(o).replace(/^\s*\(?\s*[a-dA-D]\s*\)?\s*[.)\]:-]?\s*/, "");
    for (const m of body.matchAll(/\b([1-9])\b/g)) max = Math.max(max, Number(m[1]));
    for (const m of body.matchAll(/\b(I{1,3}V?|IV|V)\b/g)) {
      const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[m[1]];
      if (roman) max = Math.max(max, roman);
    }
  }
  return max;
}

/** How many numbered/roman statements the question body actually contains. */
function statementsInQuestion(question) {
  const text = stripTags(question);
  const nums = new Set();
  for (const m of text.matchAll(/(?:^|\n)\s*\(?\s*([1-9])\s*[.)]\s+\S/g)) nums.add(Number(m[1]));
  for (const m of text.matchAll(/(?:^|\n)\s*\(?\s*(I{1,3}V?|IV|V)\s*[.)]\s+\S/g)) {
    const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 }[m[1]];
    if (roman) nums.add(roman);
  }
  return nums.size ? Math.max(...nums) : 0;
}

const findings = [];
const add = (doc, code, severity, detail) =>
  findings.push({ id: doc.id, container: doc._c, exam: doc.exam, year: doc.year, subject: doc.subject, code, severity, detail });

const all = [];
for (const name of CONTAINERS) {
  const { resources } = await db
    .container(name)
    .items.query("SELECT c.id, c.exam, c.year, c.subject, c.question, c.options, c.answer, c.explanation, c.needsReview FROM c")
    .fetchAll();
  for (const r of resources) all.push({ ...r, _c: name });
  console.log(`loaded ${name.padEnd(18)} ${resources.length}`);
}
console.log(`\ntotal ${all.length} objective questions\n`);

for (const doc of all) {
  const opts = Array.isArray(doc.options) ? doc.options : null;
  const answer = String(doc.answer ?? "").trim();
  const explanation = String(doc.explanation ?? "");

  // ---- Layer 0: structural ----
  if (!opts || opts.length < 2) {
    add(doc, "OPTIONS_MISSING", "critical", `options length = ${opts ? opts.length : "none"}`);
  } else {
    if (opts.some((o) => !String(o ?? "").trim())) add(doc, "OPTION_BLANK", "critical", "at least one option is empty");
    const seen = opts.map((o) => alnum(o));
    if (new Set(seen).size !== seen.length) add(doc, "OPTION_DUPLICATE", "high", "two options are textually identical");

    if (!answer) add(doc, "ANSWER_EMPTY", "critical", "no answer stored");
    else if (!opts.some((o) => alnum(o) === alnum(answer)))
      add(doc, "ANSWER_NOT_IN_OPTIONS", "critical", `answer ${JSON.stringify(answer.slice(0, 40))} matches no option`);

    // options that are really the statements (no code options to pick from)
    const labels = opts.map(optionLabel);
    const numericLabels = labels.filter((l) => l && /[1-4]/.test(l)).length;
    if (numericLabels === opts.length && /select the (answer|correct)|code given below|which of the following/i.test(squash(doc.question)) && answer && !opts.some((o) => alnum(o) === alnum(answer)))
      add(doc, "OPTIONS_ARE_STATEMENTS", "critical", "options look like statements, not code choices");

    const refMax = maxStatementRef(opts);
    const stmtCount = statementsInQuestion(doc.question);
    if (refMax >= 2 && stmtCount >= 2 && refMax > stmtCount)
      add(doc, "STATEMENT_MISSING", "critical", `options reference statement ${refMax} but only ${stmtCount} present`);
  }

  const qtext = squash(doc.question);
  if (!qtext) add(doc, "QUESTION_EMPTY", "critical", "question body is empty");
  if (/match\s+list/i.test(qtext) && !/list\s*-?\s*(ii|2|b)/i.test(qtext))
    add(doc, "MATCHLIST_NO_LIST2", "critical", "'Match List' question with no List-II");

  if (!explanation.trim()) add(doc, "EXPLANATION_EMPTY", "medium", "no explanation");

  // ---- Layer 1: contradiction ----
  if (DELIBERATION.test(explanation)) add(doc, "EXPLANATION_DELIBERATION", "high", squash(explanation).slice(0, 110));

  const ansLabel = optionLabel(answer);
  if (ansLabel && /[a-d]/.test(ansLabel) && explanation.trim()) {
    const asserted = assertedLetters(explanation);
    if (asserted.length && !asserted.includes(ansLabel))
      add(doc, "EXPLANATION_CONTRADICTS", "critical", `answer is (${ansLabel}) but explanation asserts (${asserted.join(")/(")})`);
  }
}

// ---- Layer 2 preview: exact duplicates ----
const groups = new Map();
for (const doc of all) {
  if (alnum(doc.question).length < 40) continue;
  const key = alnum(doc.question) + "||" + (Array.isArray(doc.options) ? doc.options.map(alnum).sort().join("|") : "");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(doc);
}
const dupGroups = [...groups.values()].filter((g) => g.length > 1);
const dupConflicts = dupGroups.filter((g) => new Set(g.map((d) => alnum(d.answer))).size > 1);

// ---- report ----
const bySeverity = { critical: 0, high: 0, medium: 0 };
const byCode = {};
for (const f of findings) {
  bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  byCode[f.code] = (byCode[f.code] || 0) + 1;
}

console.log("FINDINGS BY CODE");
for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1]))
  console.log("  " + code.padEnd(26) + String(n).padStart(6));
console.log("\nBY SEVERITY  critical=%d  high=%d  medium=%d", bySeverity.critical || 0, bySeverity.high || 0, bySeverity.medium || 0);
console.log("affected documents:", new Set(findings.map((f) => f.id)).size);

console.log("\nDUPLICATES  groups=%d  documents=%d  redundant=%d  conflicting=%d",
  dupGroups.length, dupGroups.reduce((s, g) => s + g.length, 0), dupGroups.reduce((s, g) => s + g.length - 1, 0), dupConflicts.length);
for (const g of dupConflicts)
  console.log("  ! " + g.map((d) => `${d.id}(${d._c})=${String(d.answer).slice(0, 28)}`).join("  VS  "));

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: { questions: all.length, findings: findings.length, affected: new Set(findings.map((f) => f.id)).size, byCode, bySeverity },
    duplicates: {
      groups: dupGroups.length,
      redundant: dupGroups.reduce((s, g) => s + g.length - 1, 0),
      conflicts: dupConflicts.map((g) => g.map((d) => ({ id: d.id, container: d._c, exam: d.exam, answer: d.answer }))),
    },
    findings,
  }, null, 2));
  console.log("\nreport written to", JSON_OUT);
}
