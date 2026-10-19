import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { readEmbeddingConfig } from "../../features/similarity/config";
import { GoogleEmbeddingAI } from "../../features/similarity/google";
import { buildEmbeddingInput, ConceptPipeline, hashContent } from "../../features/similarity/pipeline";
import { createRepository, ensureContainers } from "../../features/similarity/repository";
import { classificationReviewIssue, conceptReviewIssue, extractionBatchSchema, validateExtraction } from "../../features/similarity/schema";
import { validateVerificationBinding } from "../../features/similarity/verification";

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" }, process: { type: "boolean", default: false },
      force: { type: "boolean", default: false }, help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(`npm run similarity:import -- --file PATH [--process] [--force]
Default: validate every source-bound extraction without AI calls or writes.
--process enables Gemini embeddings, Cosmos profile/concept writes and question verification metadata updates; never calls text generation.
--force requires --process and reapplies imported concepts.
The file must contain formatVersion "1", extractionModel, and entries with
sourceContainer, questionId, sourceContentHash, and extraction.
Include source-grounded concept_review decisions. Missing or unresolved reviews
are queued as pending_review during processing; other entries continue.`);
    return;
  }
  if (!values.file?.trim()) throw new Error("--file is required.");
  if (values.force && !values.process) throw new Error("--force requires --process.");
  const batch = extractionBatchSchema.parse(JSON.parse(await readFile(values.file, "utf8")));
  const repository = createRepository();
  const reviewNeeded: { id: string; reason: string }[] = [];
  for (const entry of batch.entries) {
    const question = await repository.readQuestion(entry);
    if (hashContent(question) !== entry.sourceContentHash) {
      throw new Error(`Outdated source hash for ${entry.sourceContainer}:${entry.questionId}. No batch processing started.`);
    }
    const extraction = validateExtraction(entry.extraction, question);
    validateVerificationBinding(entry.verification, entry.sourceContentHash, hashContent(extraction));
    const classificationIssue = classificationReviewIssue(extraction);
    const conceptIssue = conceptReviewIssue(extraction);
    const issues = [classificationIssue, conceptIssue].filter(Boolean);
    if (issues.length) reviewNeeded.push({ id: `${entry.sourceContainer}:${entry.questionId}`, reason: issues.join(" ") });
    else buildEmbeddingInput(extraction);
  }
  console.log(`Validated ${batch.entries.length} imported extractions from ${batch.extractionModel}.`);
  if (reviewNeeded.length) console.log(JSON.stringify({ reviewNeeded }));
  if (!values.process) {
    console.log("Read-only validation complete. Add --process to generate embeddings and save profiles.");
    return;
  }
  const config = { ...readEmbeddingConfig(), extractionModel: batch.extractionModel };
  await ensureContainers(repository.database, config.dimensions, false);
  const pipeline = new ConceptPipeline(repository, new GoogleEmbeddingAI(config), config);
  const counts = { ready: 0, skipped: 0, pending_review: 0, failed: 0 };
  const pendingReview: string[] = [];
  for (const entry of batch.entries) {
    try {
      const result = await pipeline.processImported(entry, values.force);
      counts[result]++;
      if (result === "pending_review") pendingReview.push(`${entry.sourceContainer}:${entry.questionId}`);
      console.log(`${entry.sourceContainer}:${entry.questionId}: ${result}`);
    } catch (error) {
      counts.failed++;
      console.error(error instanceof Error ? error.message.replaceAll(config.apiKey, "[REDACTED]") : "Imported profile processing failed.");
    }
  }
  console.log(JSON.stringify({ ...counts, pendingReview }));
  if (counts.failed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Extraction import failed.");
  process.exitCode = 1;
});
