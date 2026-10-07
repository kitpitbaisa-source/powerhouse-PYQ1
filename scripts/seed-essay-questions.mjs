import "dotenv/config";
import fs from "node:fs";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = process.env.COSMOS_DATABASE || "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const questions = JSON.parse(
  fs.readFileSync(new URL("../src/essay-questions.json", import.meta.url), "utf8")
);
const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);
const targetName = "essay-questions";
const otherContainers = [
  "questions",
  "state_pcs",
  "mains-questions",
  "csat-questions",
  "english-questions",
  "toppers-copy",
];

const requestedIds = new Set(questions.map(question => String(question.id)));
if (requestedIds.size !== questions.length) {
  throw new Error("Essay source data contains duplicate IDs.");
}

for (const containerName of otherContainers) {
  const { resources } = await database
    .container(containerName)
    .items.query("SELECT c.id FROM c WHERE c.id != '__cache_version__' AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false)")
    .fetchAll();
  const collision = resources.find(item => requestedIds.has(String(item.id)));
  if (collision) {
    throw new Error(`Essay ID ${collision.id} is already used by ${containerName}. Re-run the global ID allocation.`);
  }
}

await database.containers.createIfNotExists({
  id: targetName,
  partitionKey: { paths: ["/id"] },
});
const container = database.container(targetName);
const { resources: existing } = await container.items
  .query("SELECT c.id, c.question, c.year, c.exam FROM c")
  .fetchAll();
const existingById = new Map(existing.map(item => [String(item.id), item]));

let created = 0;
let updated = 0;
for (const question of questions) {
  const previous = existingById.get(String(question.id));
  await container.items.upsert(question);
  if (previous) updated += 1;
  else created += 1;
}

const { resources: stored } = await container.items
  .query("SELECT c.id, c.year, c.exam, c.topic, c.question FROM c")
  .fetchAll();
if (stored.length !== questions.length) {
  throw new Error(`Expected ${questions.length} essay questions after upload, found ${stored.length}.`);
}

console.log(`Essay questions ready: ${created} created, ${updated} updated, ${stored.length} total.`);
