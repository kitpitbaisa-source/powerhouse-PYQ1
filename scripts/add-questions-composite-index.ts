import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

// One-time script: add a composite index (year DESC, id DESC) to the `questions`
// container so `SELECT TOP N ... ORDER BY c.year DESC, c.id DESC` can be served
// natively (fast, cheap) instead of reading the whole collection and sorting in JS.
// Run once: npx tsx scripts/add-questions-composite-index.ts

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container("questions");

const desired = [
  { path: "/year", order: "descending" as const },
  { path: "/id", order: "descending" as const },
];

const sig = (arr: { path: string; order: string }[]) =>
  arr.map((c) => `${c.path}:${c.order}`).join(",");

const { resource: def } = await container.read();
if (!def) {
  console.error("Could not read `questions` container definition.");
  process.exit(1);
}

def.indexingPolicy = def.indexingPolicy || {};
const composites: any[] = def.indexingPolicy.compositeIndexes || [];

const already = composites.some((ci: any) => sig(ci) === sig(desired));
if (already) {
  console.log("Composite index (year DESC, id DESC) already present. Nothing to do.");
  process.exit(0);
}

composites.push(desired);
def.indexingPolicy.compositeIndexes = composites;

await container.replace(def as any);
console.log("Composite index (year DESC, id DESC) added to `questions`. Cosmos will build it in the background.");
process.exit(0);
