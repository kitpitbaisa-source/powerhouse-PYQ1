import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CosmosClient, type Container, type SqlQuerySpec } from "@azure/cosmos";
import { capf2015AnswerKey, capf2015Review, capf2015Questions as mcqData } from "../src/questions";

const processImport = process.argv.includes("--process");
assert(process.argv.slice(2).every(argument => argument === "--process"), "Only --process is supported; default is a read-only preflight.");
assert(process.env.COSMOS_KEY, "COSMOS_KEY is missing; no writes attempted.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewDirectory = path.join(root, "review", "capf-2015");
const batchId = "capf-2015-paper1-series-a";
const sourceHash = createHash("sha256").update(JSON.stringify(mcqData)).digest("hex");
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/",
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE || "pyqpowerhouse");
const target = database.container("questions");

const embedImages = async (text: string) => {
  const matches = [...text.matchAll(/src="assets\/([a-z0-9-]+\.png)"/g)];
  for (const match of matches) {
    const bytes = await fs.readFile(path.join(reviewDirectory, "assets", match[1]));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Invalid PNG: ${match[1]}`);
    text = text.replace(match[0], `src="data:image/png;base64,${bytes.toString("base64")}"`);
  }
  assert(!text.includes('src="assets/'), "Unresolved local image reference.");
  return text;
};

assert.equal(mcqData.length, 125, "Expected exactly 125 source questions.");
assert.equal(capf2015AnswerKey.length, 125, "Expected exactly 125 key entries.");
const documents = await Promise.all(mcqData.map(async (question, index) => {
  assert.equal(question.questionNumber, index + 1, "Source numbering is incomplete.");
  assert.equal(question.id, capf2015Review.firstId + index, "Source IDs are not incrementing.");
  assert.equal(question.options.length, 4, `Q${index + 1} does not have four options.`);
  assert.equal(question.answerLetter, capf2015AnswerKey[index], `Q${index + 1} differs from the provided key.`);
  assert(question.question.trim() && question.explanation.trim(), `Q${index + 1} has empty content.`);
  const options = await Promise.all(question.options.map(embedImages));
  const answerIndex = "ABCD".indexOf(question.answerLetter);
  assert(answerIndex >= 0, `Q${index + 1} has an invalid key letter.`);
  const document = {
    ...question,
    id: String(question.id),
    question: await embedImages(question.question),
    options,
    answer: options[answerIndex],
    isActive: true,
    needsReview: Boolean(question.reviewNotes?.length),
    source: {
      importBatch: batchId,
      sourceHash,
      paper: capf2015Review.paper,
      series: capf2015Review.series,
      questionNumber: question.questionNumber,
      sourcePage: question.sourcePage,
      sourcePaper: capf2015Review.sourcePaper,
      sourceAnswerKey: capf2015Review.sourceAnswerKey,
      answerKeyProvenance: capf2015Review.answerKeyProvenance,
      explanationProvenance: capf2015Review.explanationProvenance,
    },
  };
  assert(Buffer.byteLength(JSON.stringify(document), "utf8") < 1_900_000, `Q${index + 1} is too large for Cosmos.`);
  return document;
}));

type ImportDocument = typeof documents[number];
type ExistingDocument = Partial<ImportDocument> & { id: string; isActive?: boolean };
const verifyDocument = (stored: ExistingDocument | undefined, expected: ImportDocument) => {
  assert(stored, `Question ${expected.id} is missing.`);
  for (const field of Object.keys(expected) as (keyof ImportDocument)[]) {
    assert.deepEqual(stored[field], expected[field], `Stored ${field} differs for question ${expected.id}.`);
  }
};

const { resource: definition } = await target.read();
assert.deepEqual(definition?.partitionKey?.paths, ["/id"], "Unexpected questions partition key; aborting.");
const requestedIds = new Set(documents.map(document => document.id));
assert.equal(requestedIds.size, 125, "Duplicate source IDs.");
const containers = ["questions", "state_pcs", "mains-questions", "essay-questions", "csat-questions", "english-questions", "toppers-copy"];
await Promise.all(containers.map(async name => {
  const { resources } = await database.container(name).items.query<{ id: string; source?: ImportDocument["source"] }>(
    "SELECT c.id, c.source FROM c WHERE c.id != '__cache_version__'"
  ).fetchAll();
  for (const existing of resources) {
    if (!requestedIds.has(String(existing.id))) continue;
    assert(name === "questions" && existing.source?.importBatch === batchId && existing.source.sourceHash === sourceHash,
      `ID collision: ${existing.id} in ${name}. No existing item will be overwritten.`);
  }
}));

const capfQuery: SqlQuerySpec = {
  query: "SELECT * FROM c WHERE CONTAINS(UPPER(c.exam), @exam) AND (c.year = @year OR c.year = @numericYear)",
  parameters: [{ name: "@exam", value: "CAPF" }, { name: "@year", value: "2015" }, { name: "@numericYear", value: 2015 }],
};
const { resources: existingPaper } = await target.items.query<ExistingDocument>(capfQuery).fetchAll();
const alreadyImported = new Map<string, ExistingDocument>();
for (const existing of existingPaper) {
  assert(requestedIds.has(String(existing.id)) && existing.source?.importBatch === batchId && existing.source.sourceHash === sourceHash,
    `Existing CAPF 2015 item ${existing.id} requires manual duplicate review; aborting without overwriting.`);
  const expected = documents.find(document => document.id === String(existing.id));
  assert(expected, `Unexpected previously imported ID ${existing.id}.`);
  verifyDocument(existing, expected);
  alreadyImported.set(String(existing.id), existing);
}
console.log(`Preflight: ${documents.length} questions; ${alreadyImported.size} already match; ${documents.length - alreadyImported.size} to create; no ID collisions.`);
if (!processImport) {
  console.log("Read-only preflight complete. Use --process to create missing items and verify them.");
} else {
  const verifyStored = async (container: Container, expected: ImportDocument) => {
    const { resource } = await container.item(expected.id, expected.id).read<ExistingDocument>();
    verifyDocument(resource, expected);
  };
  let created = 0;
  for (const document of documents) {
    if (!alreadyImported.has(document.id)) {
      // Create, never upsert: a concurrent ID allocation must fail rather than overwrite.
      await target.items.create(document);
      created++;
    }
    await verifyStored(target, document);
    if (document.questionNumber % 25 === 0) console.log(`Verified ${document.questionNumber}/125.`);
  }
  const { resources: finalPaper } = await target.items.query<ExistingDocument>(capfQuery).fetchAll();
  assert.equal(finalPaper.length, 125, "Unexpected final CAPF 2015 paper count.");
  for (const document of documents) {
    const matches = finalPaper.filter(stored => stored.id === document.id);
    assert.equal(matches.length, 1, `Missing or duplicate stored question ${document.id}.`);
    verifyDocument(matches[0], document);
  }
  await target.items.upsert({ id: "__cache_version__", version: Date.now() });
  const receipt = {
    status: "verified",
    importBatch: batchId,
    sourceHash,
    verifiedAt: new Date().toISOString(),
    container: "questions",
    created,
    previouslyMatching: alreadyImported.size,
    verifiedCount: documents.length,
    firstId: documents[0].id,
    lastId: documents[documents.length - 1].id,
    ids: documents.map(document => document.id),
    questionsWithReviewNotes: documents.filter(document => document.needsReview).map(document => document.questionNumber),
    imageStorage: "Original PNG crops embedded as data URIs; no static-asset deployment required.",
  };
  await fs.writeFile(path.join(reviewDirectory, "upload-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`Cosmos import verified: ${created} created, ${documents.length} stored; IDs ${receipt.firstId}-${receipt.lastId}.`);
}
