import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

// Read-only. Reports ids shared between the `questions` and `state_pcs`
// containers (both are merged into Prelims by /api/questions, and both use
// their own numeric id sequence, so the ranges collide).
// Run: npx tsx scripts/audit-duplicate-ids.ts

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

const read = async (containerId: string) => {
  const { resources } = await database
    .container(containerId)
    .items.query(
      // Mirror the API: documents retired by the id migration (isActive = false)
      // are tombstones and are never served, so they must not count as duplicates.
      "SELECT c.id, c.year, c.exam, c.subject FROM c WHERE c.id != '__cache_version__' AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false)"
    )
    .fetchAll();
  return resources as { id: string; year?: string; exam?: string; subject?: string }[];
};

const questions = await read("questions");
const statePcs = await read("state_pcs");

console.log(`questions : ${questions.length} docs`);
console.log(`state_pcs : ${statePcs.length} docs`);
console.log(`merged    : ${questions.length + statePcs.length} rows served by /api/questions`);

const numeric = (list: { id: string }[]) =>
  list.map(d => Number(d.id)).filter(n => Number.isFinite(n));
const range = (list: { id: string }[]) => {
  const nums = numeric(list);
  return nums.length ? `${Math.min(...nums)} … ${Math.max(...nums)}` : "n/a";
};
console.log(`\nid range questions : ${range(questions)}`);
console.log(`id range state_pcs : ${range(statePcs)}`);

const qIds = new Map(questions.map(d => [String(d.id), d]));
const collisions = statePcs.filter(d => qIds.has(String(d.id)));

console.log(`\ncross-container id collisions: ${collisions.length}`);
for (const dup of collisions.slice(0, 5)) {
  const other = qIds.get(String(dup.id))!;
  console.log(`  id=${dup.id}`);
  console.log(`    questions : ${other.exam} / ${other.year}`);
  console.log(`    state_pcs : ${dup.exam} / ${dup.year}`);
}
if (collisions.length > 5) console.log(`  ...and ${collisions.length - 5} more`);

// Duplicates *within* each container would be a separate problem.
const within = (list: { id: string }[], label: string) => {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const d of list) {
    const id = String(d.id);
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  console.log(`duplicate ids within ${label}: ${dupes.size}`);
};
within(questions, "questions");
within(statePcs, "state_pcs");

// How much saved user data points at a colliding id?
const collidingIds = new Set(collisions.map(d => String(d.id)));
const { resources: userDocs } = await database
  .container("user-questions")
  .items.query(
    "SELECT c.questionId, c.questionType, c.isBookmarked, c.notes, c.attemptCount FROM c WHERE c.questionType = 'prelims' AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false)"
  )
  .fetchAll();

const affected = userDocs.filter((d: any) => collidingIds.has(String(d.questionId)));
console.log(`\nuser-questions prelims docs: ${userDocs.length}`);
console.log(`  referencing a colliding id: ${affected.length}`);
console.log(`    with attempts  : ${affected.filter((d: any) => (d.attemptCount ?? 0) > 0).length}`);
console.log(`    with bookmarks : ${affected.filter((d: any) => d.isBookmarked).length}`);
console.log(`    with notes     : ${affected.filter((d: any) => (d.notes || "").trim()).length}`);

process.exit(0);
