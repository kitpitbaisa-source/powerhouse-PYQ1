import assert from "node:assert/strict";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";
import { createRepository } from "../../features/similarity/repository.js";
import { canonicalConceptSchema } from "../../features/similarity/schema.js";
import { hashContent } from "../../features/similarity/content-hash.js";
import { registryFingerprint } from "../../features/similarity/concept-review.js";
import { createCompletedReceipt, createRegistryChecker, reviewTaskFingerprint } from "../../features/similarity/registry-check.mjs";

const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const option = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = (name: string) => {
  const value = option(name);
  assert.ok(value, `Missing --${name}=<path or value>.`);
  return value;
};
async function atomic(file: string, value: unknown) {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { flag: "wx" });
  await rename(temporary, file);
  assert.equal(hashContent(await read(file)), hashContent(value), "Workspace read-back mismatch.");
}

async function importGlobal(manifestFile: string) {
  const manifest = await read(manifestFile);
  assert.equal(hashContent({ sources: manifest.sources, proposals: manifest.proposals }), manifest.sourceProposalFingerprint);
  const targets = manifest.proposals.map((proposal: any) => ({
    id: proposal.id,
    definition: canonicalConceptSchema.omit({ status: true, taxonomyVersion: true, retirement: true }).parse(proposal),
    sources: proposal.memberships.map((membership: any) => {
      const source = manifest.sources.find((source: any) => source.id === membership.questionId);
      assert.ok(source);
      return { id: source.id, question: source.question, role: membership.role,
        roleStatus: membership.roleStatus, sourceEvidence: membership.sourceEvidence,
        issues: source.originalIssues, heldReasons: source.scopedHeldReasons };
    }),
  }));
  assert.deepEqual(targets.map((target: any) => target.id).sort(), [...manifest.scanConceptIds].sort());
  const receipts = [];
  const incomplete = [];
  let compared = 0;
  for (const chunk of manifest.chunks) {
    const data = await read(path.join(path.dirname(manifestFile), `${chunk.chunkId}.json`));
    const records = data.records.map((row: any[]) =>
      canonicalConceptSchema.parse(Object.fromEntries(data.columns.map((key: string, index: number) => [key, row[index]]))));
    assert.equal(data.startIndex, compared);
    assert.equal(chunk.startIndex, compared);
    assert.equal(records.length, chunk.conceptCount);
    assert.equal(data.conceptCount, chunk.conceptCount);
    assert.equal(registryFingerprint(records), chunk.registryFingerprint);
    assert.equal(data.registryFingerprint, chunk.registryFingerprint);
    assert.equal(data.sourceProposalFingerprint, manifest.sourceProposalFingerprint);
    compared += records.length;
    const owners = manifest.assignments.filter((assignment: any) =>
      assignment.chunks.some((owned: any) => owned.chunkId === chunk.chunkId));
    assert.equal(owners.length, 1);
    const file = path.join(path.dirname(manifestFile), "receipts", owners[0].name, `${chunk.chunkId}.json`);
    let review;
    try { review = await read(file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      incomplete.push(chunk.chunkId);
      continue;
    }
    assert.equal(review.chunkId, chunk.chunkId);
    assert.equal(review.startIndex, chunk.startIndex);
    assert.equal(review.conceptCount, chunk.conceptCount);
    assert.equal(review.registryFingerprint, chunk.registryFingerprint);
    assert.equal(review.globalRegistryFingerprint, manifest.globalRegistryFingerprint);
    assert.equal(review.sourceProposalFingerprint, manifest.sourceProposalFingerprint);
    assert.match(review.reviewedBy, /GPT-6\.1 Sol/);
    receipts.push(createCompletedReceipt(targets, records, review));
  }
  assert.equal(compared, manifest.activeRegistryCount);
  return { targets, receipts, incomplete };
}

async function main() {
  const command = process.argv[2];
  if (!command || command === "help" || command === "--help") {
    console.log(`Registry checks (no model calls or canonical writes)
  capture --output=<workspace.json> [--global-review=<manifest.json>]
          [--targets=<targets.json>] [--reuse=<prior-workspace.json>]
  search  --workspace=<workspace.json> --query=<words>
  plan    --workspace=<workspace.json> --output=<review-queue.json> [--include-uncertain]
  import  --workspace=<workspace.json> --queue=<review-queue.json>
          --result=<review-result.json> --output=<workspace.json>

capture reads the live registry; all other commands use local files.
Existing output is reused automatically by capture. Only unchanged, source-bound
comparisons count. Changed records and unresolved conflicts return to the queue.
Search hits and complete cached comparisons NEVER automatically admit concepts.`);
    return;
  }
  if (command === "capture") {
    const output = required("output");
    let previous: any;
    const reuse = option("reuse") ?? output;
    try { previous = await read(reuse); createRegistryChecker(previous); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const imported = option("global-review") ? await importGlobal(option("global-review")!) : undefined;
    const targets = option("targets") ? await read(option("targets")!) : imported?.targets ?? previous?.targets ?? [];
    assert.ok(Array.isArray(targets), "Targets must be an array of exact definitions and source contexts.");
    dotenv.config({ quiet: true });
    const repository = createRepository();
    let concepts;
    try { concepts = await repository.listConcepts(); }
    finally { repository.database.client.dispose(); }
    const receipts = [...new Map([...(previous?.receipts ?? []), ...(imported?.receipts ?? [])]
      .map((receipt: any) => [receipt.id, receipt])).values()];
    const workspace = { formatVersion: 1, capturedAt: new Date().toISOString(),
      concepts, registryFingerprint: registryFingerprint(concepts), targets, receipts };
    const checker = createRegistryChecker(workspace);
    await atomic(output, workspace);
    console.log(JSON.stringify({ ...checker.summary, subjects: undefined, topics: undefined,
      targets: undefined, targetCount: targets.length, incompleteChunks: imported?.incomplete, output }, null, 2));
    return;
  }
  const workspace = await read(required("workspace"));
  const checker = createRegistryChecker(workspace);
  if (command === "search") {
    console.log(JSON.stringify(checker.search({ query: required("query") }, option("target")), null, 2));
  } else if (command === "plan") {
    const queue = checker.reviewTasks(250, process.argv.includes("--include-uncertain"));
    await atomic(required("output"), queue);
    console.log(JSON.stringify({ taskCount: queue.tasks.length,
      remainingComparisons: checker.summary.remainingComparisons,
      uncertainComparisons: checker.summary.uncertainComparisons, output: required("output") }));
  } else if (command === "import") {
    const queue = await read(required("queue"));
    const result = await read(required("result"));
    const task = queue.tasks.find((task: any) => task.id === result.taskId);
    assert.ok(task, "Review result does not identify a task in the supplied queue.");
    const targets = task.targetIds.map((id: string) => queue.targets.find((target: any) => target.id === id));
    assert.ok(targets.every(Boolean));
    assert.equal(targets.length, task.targetIds.length);
    assert.equal(reviewTaskFingerprint(targets, task.records), result.taskId, "Review task context was changed.");
    const receipt = createCompletedReceipt(targets, task.records, result);
    const updated = { ...workspace,
      receipts: [...new Map([...workspace.receipts, receipt].map((item: any) => [item.id, item])).values()] };
    const after = createRegistryChecker(updated);
    await atomic(required("output"), updated);
    console.log(JSON.stringify({ receiptId: receipt.id, remainingComparisons: after.summary.remainingComparisons,
      admissionApproved: false, output: required("output") }));
  } else throw new Error(`Unknown command ${command}. Run registry:check -- help.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
