/**
 * Migrate `state_pcs` question ids out of the range that collides with the
 * `questions` container, and update every reference to the moved questions.
 *
 * Cosmos ids are immutable and `id` is the partition key on `state_pcs`, so a
 * "re-id" is: write a new document, then SOFT DELETE the old one. Nothing is
 * ever hard deleted.
 *
 *   newId = 20000000 + (oldId - 12021671)      // 20000000 .. 20002249
 *
 * References updated:
 *   - user-questions  (id `prelims:<questionId>`, pk /userId) -> new doc + soft delete old
 *   - feedback        (pk /id)                                -> questionId rewritten in place
 *
 * Ids that exist in BOTH containers are "ambiguous": a user record pointing at
 * one cannot be attributed to a specific question, so its references are left
 * untouched (they resolve to the `questions` row, which is not moving).
 *
 * Usage:
 *   npx tsx scripts/migrate-state-pcs-ids.ts            # dry run, writes nothing
 *   npx tsx scripts/migrate-state-pcs-ids.ts --apply    # perform the migration
 */
import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const APPLY = process.argv.includes("--apply");
const ID_BASE = 20_000_000;
const PCS_MIN = 12_021_671;

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
if (!key) {
  console.error("COSMOS_KEY is not set. Add it to .env before running.");
  process.exit(1);
}

const db = new CosmosClient({ endpoint, key }).database("pyqpowerhouse");
const statePcs = db.container("state_pcs");
const questions = db.container("questions");
const userQuestions = db.container("user-questions");
const feedback = db.container("feedback");

const now = new Date().toISOString();
const strip = (doc: any) => {
  const out: any = {};
  for (const [k, v] of Object.entries(doc)) if (!k.startsWith("_")) out[k] = v;
  return out;
};
const log = (...args: any[]) => console.log(...args);

async function main() {
  log(`\n=== state_pcs id migration — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`);

  // ---- 1. Load both question containers -----------------------------------
  const { resources: pcsDocs } = await statePcs.items.query("SELECT * FROM c").fetchAll();
  const { resources: qRows } = await questions.items.query("SELECT c.id FROM c").fetchAll();
  const questionIds = new Set(qRows.map((r: any) => String(r.id)));

  const live = pcsDocs.filter((d: any) => d.isActive !== false);
  const alreadyMoved = pcsDocs.filter((d: any) => d.isActive === false).length;

  log(`state_pcs: ${pcsDocs.length} docs (${live.length} live, ${alreadyMoved} already soft-deleted)`);
  log(`questions: ${questionIds.size} ids`);

  // ---- 2. Build the mapping and assert it is safe --------------------------
  const map = new Map<string, string>(); // oldId -> newId
  const ambiguous = new Set<string>();
  const skipped: string[] = [];

  for (const doc of live) {
    const oldId = String(doc.id);
    const n = Number(oldId);
    if (!Number.isFinite(n)) {
      skipped.push(oldId);
      continue;
    }
    if (n >= ID_BASE) {
      skipped.push(oldId); // already in the reserved range
      continue;
    }
    map.set(oldId, String(ID_BASE + (n - PCS_MIN)));
    if (questionIds.has(oldId)) ambiguous.add(oldId);
  }

  const pcsIds = new Set(pcsDocs.map((d: any) => String(d.id)));
  const conflicts = [...map.values()].filter((id) => questionIds.has(id) || pcsIds.has(id));
  if (conflicts.length) {
    console.error(`ABORT: ${conflicts.length} target ids already exist, e.g. ${conflicts.slice(0, 5).join(", ")}`);
    process.exit(1);
  }
  if (new Set(map.values()).size !== map.size) {
    console.error("ABORT: mapping is not one-to-one.");
    process.exit(1);
  }

  const newIds = [...map.values()].map(Number);
  log(`\nMapping: ${map.size} questions -> ${Math.min(...newIds)} .. ${Math.max(...newIds)}`);
  log(`  colliding (ambiguous) ids: ${ambiguous.size}`);
  log(`  clean ids:                 ${map.size - ambiguous.size}`);
  if (skipped.length) log(`  skipped (non-numeric / already migrated): ${skipped.length}`);

  // ---- 3. Find every reference to the moved questions ----------------------
  const { resources: uqDocs } = await userQuestions.items
    .query("SELECT * FROM c WHERE c.questionType = 'prelims'")
    .fetchAll();
  const uqHits = uqDocs.filter((d: any) => map.has(String(d.questionId)));
  const uqMovable = uqHits.filter((d: any) => !ambiguous.has(String(d.questionId)));

  const { resources: fbDocs } = await feedback.items
    .query("SELECT * FROM c WHERE IS_DEFINED(c.questionId) AND c.questionId != null")
    .fetchAll();
  const fbHits = fbDocs.filter(
    (d: any) => (d.questionType || "prelims") === "prelims" && map.has(String(d.questionId))
  );
  const fbMovable = fbHits.filter((d: any) => !ambiguous.has(String(d.questionId)));

  log(`\nReferences:`);
  log(`  user-questions: ${uqHits.length} match a moved id -> ${uqMovable.length} remapped, ${uqHits.length - uqMovable.length} left (ambiguous)`);
  log(`  feedback:       ${fbHits.length} match a moved id -> ${fbMovable.length} remapped, ${fbHits.length - fbMovable.length} left (ambiguous)`);

  if (!APPLY) {
    log(`\nSample mapping:`);
    for (const [o, n] of [...map.entries()].slice(0, 5)) log(`  ${o} -> ${n}${ambiguous.has(o) ? "  (ambiguous)" : ""}`);
    log(`\nNo writes performed. Re-run with --apply to execute.\n`);
    return;
  }

  // ---- 4. Move the question documents --------------------------------------
  let created = 0;
  let retired = 0;
  let failed = 0;

  for (const doc of live) {
    const oldId = String(doc.id);
    const newId = map.get(oldId);
    if (!newId) continue;
    try {
      await statePcs.items.upsert({ ...strip(doc), id: newId, legacyId: oldId, migratedAt: now, isActive: true });
      created++;
      await statePcs.items.upsert({
        ...strip(doc),
        isActive: false,
        deletedAt: now,
        supersededBy: newId,
        migrationReason: "duplicate-id-with-questions-container",
      });
      retired++;
    } catch (error: any) {
      failed++;
      console.error(`  ! ${oldId} -> ${newId}: ${error.message}`);
    }
    if (created % 250 === 0) log(`  ...${created}/${map.size} questions moved`);
  }
  log(`\nQuestions: ${created} created, ${retired} soft-deleted, ${failed} failed`);

  // ---- 5. Remap user-questions ---------------------------------------------
  let uqDone = 0;
  let uqFail = 0;
  for (const doc of uqMovable) {
    const oldId = String(doc.questionId);
    const newId = map.get(oldId)!;
    try {
      await userQuestions.items.upsert({
        ...strip(doc),
        id: `prelims:${newId}`,
        questionId: Number.isFinite(Number(doc.questionId)) ? Number(newId) : newId,
        legacyQuestionId: doc.questionId,
        migratedAt: now,
      });
      await userQuestions.items.upsert({
        ...strip(doc),
        isActive: false,
        deletedAt: now,
        supersededBy: `prelims:${newId}`,
      });
      uqDone++;
    } catch (error: any) {
      uqFail++;
      console.error(`  ! user-questions ${doc.id}: ${error.message}`);
    }
  }
  log(`user-questions: ${uqDone} remapped, ${uqFail} failed`);

  // ---- 6. Remap feedback (pk is /id, so patch in place) ---------------------
  let fbDone = 0;
  let fbFail = 0;
  for (const doc of fbMovable) {
    const oldId = String(doc.questionId);
    const newId = map.get(oldId)!;
    try {
      await feedback.items.upsert({
        ...strip(doc),
        questionId: Number.isFinite(Number(doc.questionId)) ? Number(newId) : newId,
        legacyQuestionId: doc.questionId,
        migratedAt: now,
      });
      fbDone++;
    } catch (error: any) {
      fbFail++;
      console.error(`  ! feedback ${doc.id}: ${error.message}`);
    }
  }
  log(`feedback:       ${fbDone} remapped, ${fbFail} failed`);

  log(`\nDone. Re-run scripts/audit-duplicate-ids.ts to verify collisions are 0.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
