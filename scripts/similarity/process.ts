import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { sourceContainers, readDimensions, readPipelineConfig } from "../../features/similarity/config";
import { GooglePipelineAI } from "../../features/similarity/google";
import { ConceptPipeline } from "../../features/similarity/pipeline";
import { createRepository, ensureContainers } from "../../features/similarity/repository";
import type { QuestionReference } from "../../features/similarity/types";

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", default: "questions" },
      id: { type: "string" },
      limit: { type: "string", default: "10" },
      process: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(`npm run similarity:process -- [--source CONTAINER] [--id ID] [--limit N] [--process] [--force]
Sources: ${sourceContainers.join(", ")}
Default: read-only preview of up to 10 question references; no AI calls or writes.
--process explicitly enables paid Gemini calls and Cosmos profile/concept writes.
--limit caps processing attempts, excluding unchanged profiles; rerun to resume.
--force re-extracts selected questions and requires --process.`);
    return;
  }
  const source = z.enum(sourceContainers).parse(values.source);
  if (!/^[1-9]\d*$/.test(values.limit)) throw new Error("--limit must be a positive integer.");
  const limit = Number(values.limit);
  if (!Number.isSafeInteger(limit)) throw new Error("--limit exceeds the supported integer range.");
  if (values.force && !values.process) throw new Error("--force requires --process.");
  const id = values.id === undefined ? undefined : z.string().trim().min(1).parse(values.id);
  const repository = createRepository();
  let pipeline: ConceptPipeline | undefined;
  if (values.process) {
    const config = readPipelineConfig();
    await ensureContainers(repository.database, config.dimensions, false);
    pipeline = new ConceptPipeline(repository, new GooglePipelineAI(config), config);
  } else {
    readDimensions();
    console.log("Read-only preview. Add --process to enable AI calls and Cosmos writes.");
  }
  const references: Iterable<QuestionReference> | AsyncIterable<QuestionReference> = id
    ? [{ sourceContainer: source, questionId: id }]
    : repository.questionReferences(source, values.process ? Number.MAX_SAFE_INTEGER : limit);
  const counts = { ready: 0, skipped: 0, failed: 0, previewed: 0 };
  for await (const reference of references) {
    const key = `${reference.sourceContainer}:${reference.questionId}`;
    if (!pipeline) {
      await repository.readQuestion(reference);
      console.log(`Would process ${key}`);
      counts.previewed++;
      continue;
    }
    try {
      const result = await pipeline.process(reference, values.force);
      counts[result]++;
      console.log(`${key}: ${result}`);
    } catch (error) {
      counts.failed++;
      console.error(`${key}: ${error instanceof Error ? error.message : "Processing failed."}`);
    }
    if (counts.ready + counts.failed >= limit) break;
  }
  console.log(JSON.stringify(counts));
  if (counts.failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Similarity pipeline failed.");
  process.exitCode = 1;
});
