import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capf2015AnswerKey, capf2015Review, capf2015Questions as mcqData } from "../src/questions";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "review", "capf-2015");
const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  assert(value && !value.startsWith("--"), `${name} requires a directory.`);
  return path.resolve(value);
};
const sourceDirectory = argument("--source-dir");
const assetsDirectory = argument("--assets-dir");
await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.join(output, "assets"), { recursive: true });

assert.equal(mcqData.length, 125, "Exactly 125 questions are required.");
assert.equal(capf2015AnswerKey.length, 125, "Exactly 125 key answers are required.");
assert.equal(new Set(mcqData.map(question => question.id)).size, 125, "Duplicate draft IDs.");
const imageNames = new Set<string>();
for (const [index, question] of mcqData.entries()) {
  const number = index + 1;
  assert.equal(question.questionNumber, number, `Missing or reordered question ${number}.`);
  assert.equal(question.id, capf2015Review.firstId + index, `Non-incrementing ID for Q${number}.`);
  assert(question.question.trim() && question.explanation.trim(), `Empty content for Q${number}.`);
  assert(question.subject.trim() && question.topic?.trim(), `Missing classification for Q${number}.`);
  assert.equal(question.options.length, 4, `Q${number} must have four options.`);
  assert.equal(new Set(question.options).size, 4, `Duplicate options for Q${number}.`);
  for (const [optionIndex, option] of question.options.entries()) {
    assert(option.startsWith(`(${"abcd"[optionIndex]}) `), `Option label mismatch in Q${number}.`);
  }
  assert.equal(question.answerLetter, capf2015AnswerKey[index], `Key mismatch for Q${number}.`);
  assert.equal(question.answer, question.options["ABCD".indexOf(question.answerLetter)], `Answer mismatch in Q${number}.`);
  assert(question.sourcePage >= 2 && question.sourcePage <= 42 && question.sourcePage % 2 === 0, `Bad source page for Q${number}.`);
  for (const text of [question.question, ...question.options]) {
    for (const match of text.matchAll(/<img src="assets\/([a-z0-9-]+\.png)" alt="[^"]*"\/>/g)) {
      imageNames.add(match[1]);
    }
  }
}

for (const name of imageNames) {
  const destination = path.join(output, "assets", name);
  if (assetsDirectory) await fs.copyFile(path.join(assetsDirectory, name), destination);
  const bytes = await fs.readFile(destination);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Invalid PNG: ${name}`);
}

const sources = [];
for (const [original, name] of [
  [capf2015Review.sourcePaper, "source-paper.pdf"],
  [capf2015Review.sourceAnswerKey, "answer-key.pdf"],
]) {
  const destination = path.join(output, name);
  if (sourceDirectory) await fs.copyFile(path.join(sourceDirectory, original), destination);
  const bytes = await fs.readFile(destination);
  assert(bytes.subarray(0, 5).toString() === "%PDF-", `Invalid source PDF: ${name}`);
  sources.push({ originalName: original, reviewFile: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}

const escape = (text: string) => text.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const format = (text: string) => escape(text)
  .replace(/&lt;br\/&gt;/g, "<br/>")
  .replace(/&lt;(\/?(?:sup|sub))&gt;/g, "<$1>")
  .replace(/&lt;img src=&quot;assets\/([a-z0-9-]+\.png)&quot; alt=&quot;([^<>]*?)&quot;\/&gt;/g,
    '<img src="assets/$1" alt="$2" loading="lazy"/>');

const flagged = mcqData.filter(question => question.reviewNotes?.length);
const sourceHash = createHash("sha256").update(JSON.stringify(mcqData)).digest("hex");
let uploadReceipt: { status: string; sourceHash: string; verifiedCount: number } | undefined;
try {
  uploadReceipt = JSON.parse(await fs.readFile(path.join(output, "upload-receipt.json"), "utf8"));
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}
if (uploadReceipt) {
  assert.equal(uploadReceipt.status, "verified", "Upload receipt is not verified.");
  assert.equal(uploadReceipt.sourceHash, sourceHash, "Source changed since upload; receipt is stale.");
  assert.equal(uploadReceipt.verifiedCount, 125, "Incomplete upload receipt.");
}
const cards = mcqData.map(question => {
  return `<article id="q${question.questionNumber}" data-flagged="${Boolean(question.reviewNotes?.length)}" data-subject="${escape(question.subject)}">
<header><h2>Q${question.questionNumber} <small>${escape(question.subject)} / ${escape(question.topic ?? "")}</small></h2>
<a href="source-paper.pdf#page=${question.sourcePage}" target="_blank" rel="noopener">Source page ${question.sourcePage}</a></header>
<p class="question">${format(question.question)}</p>
<ol class="options">${question.options.map((option, index) => `<li class="${"ABCD"[index] === question.answerLetter ? "keyed" : ""}">${format(option)}</li>`).join("")}</ol>
<p><strong>Supplied key: ${question.answerLetter}</strong> <small>ID: ${question.id}</small></p>
<div class="explanation"><strong>Study explanation</strong><p>${escape(question.explanation)}</p></div>
${question.reviewNotes?.length ? `<aside><strong>Review note</strong>${question.reviewNotes.map(note => `<p>${escape(note)}</p>`).join("")}</aside>` : ""}
</article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CAPF 2015 Set A - local review</title>
<style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#172033;background:#f3f5f9}
body{max-width:1050px;margin:30px auto;padding:0 16px}h1{font-size:1.8rem}h2{font-size:1.1rem;margin:0}
small{font-size:.82rem;color:#526077}h2 small{display:block;margin-top:5px}a{color:#164ab2}
.banner,article{background:white;border:1px solid #d8deea;border-radius:12px;padding:22px;margin:18px 0}
.banner{border-left:6px solid #cb8a00}header{display:flex;justify-content:space-between;gap:16px}
nav,.filters{display:flex;flex-wrap:wrap;gap:14px;margin:16px 0}.filters{position:sticky;top:0;background:#f3f5f9;padding:12px 0;z-index:1}
input[type=search],select{padding:10px;border:1px solid #a8b5c9;border-radius:6px}input[type=search]{flex:1;min-width:200px}
.question{line-height:1.75}.options{list-style:none;padding:0}.options li{border:1px solid #d8deea;padding:12px;margin:8px 0;border-radius:6px}
.options .keyed{border-color:#438968;background:#eff8f2}.options img{max-height:260px}
img{display:block;max-width:100%;height:auto;margin:12px 0}.explanation{background:#f3f6fb;padding:15px;border-radius:6px;line-height:1.65}
aside{border-left:4px solid #cb8a00;background:#fff8e6;padding:12px 16px;margin:12px 0;line-height:1.6}
details{margin-top:16px}article[hidden]{display:none}p{overflow-wrap:anywhere}
@media print{.filters,nav{display:none}article{break-inside:avoid}.banner,article{box-shadow:none}}
</style></head><body>
<h1>CAPF 2015 - Paper I - Set A</h1>
<section class="banner"><strong>${uploadReceipt ? "Uploaded to Cosmos - local review/source copy." : "Prepared source copy - not yet uploaded to Cosmos."}</strong>
<p>All 125 questions have four options, the supplied answer-key selection and an agent-authored study explanation.
${flagged.length} questions have explicit review/context notes. The supplied key has not been independently authenticated as an official download.</p>
<p>Question IDs: ${mcqData[0].id}-${mcqData[mcqData.length - 1].id}. The importer rechecks live-bank duplicates and ID collisions.
Image paths here are relative to this review folder; the Cosmos import embeds the original image crops in each question.</p>
<p>The answer-key scan supplies choices, not explanations. Explanations are draft teaching notes, not independently fact-checked end-to-end. Historical facts are interpreted in the 2015 examination context.</p>
<nav><a href="source-paper.pdf">Original paper</a><a href="answer-key.pdf">Supplied answer key</a><a href="questions.json">Review JSON</a><a href="manifest.json">Provenance and hashes</a></nav>
<p>Review-note questions: ${flagged.map(question => `<a href="#q${question.questionNumber}">${question.questionNumber}</a>`).join(", ")}.</p>
</section>
<div class="filters"><input id="search" type="search" aria-label="Search questions" placeholder="Search question, topic, explanation or ID"/>
<select id="subject" aria-label="Filter by subject"><option value="">All subjects</option>${[...new Set(mcqData.map(question => question.subject))].sort().map(subject => `<option>${escape(subject)}</option>`).join("")}</select>
<label><input id="flagged" type="checkbox"/> Review notes only</label><span id="count">125 shown</span></div>
<main>${cards}</main>
<script>
const articles=[...document.querySelectorAll("article")];
const search=document.getElementById("search"),subject=document.getElementById("subject"),flagged=document.getElementById("flagged");
function filter(){const term=search.value.toLowerCase().trim();let count=0;for(const article of articles){const show=(!term||article.textContent.toLowerCase().includes(term))&&(!subject.value||article.dataset.subject===subject.value)&&(!flagged.checked||article.dataset.flagged==="true");article.hidden=!show;if(show)count++;}document.getElementById("count").textContent=count+" shown";}
search.addEventListener("input",filter);subject.addEventListener("change",filter);flagged.addEventListener("change",filter);
for(const link of document.querySelectorAll('a[href^="#q"]'))link.addEventListener("click",()=>{search.value="";subject.value="";flagged.checked=false;filter();});
</script></body></html>`;

await fs.writeFile(path.join(output, "questions.json"), JSON.stringify({ metadata: capf2015Review, questions: mcqData }, null, 2) + "\n");
await fs.writeFile(path.join(output, "index.html"), html);
await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify({
  ...capf2015Review,
  approvedForLiveImport: Boolean(uploadReceipt),
  uploadReceipt: uploadReceipt ? "upload-receipt.json" : null,
  sourceFiles: sources,
  sourceCode: "src/questions.ts",
  imageAssets: [...imageNames].sort(),
  reviewNoteQuestions: flagged.map(question => question.questionNumber),
  validation: { questions: mcqData.length, answerKeyEntries: capf2015AnswerKey.length, optionsPerQuestion: 4, questionsWithExplanations: mcqData.filter(question => question.explanation.trim()).length },
}, null, 2) + "\n");
console.log(`Prepared ${mcqData.length} CAPF 2015 questions with explanations; ${flagged.length} have review notes.`);
console.log(`Review: ${path.join(output, "index.html")}`);
