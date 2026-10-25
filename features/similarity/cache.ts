import express from "express";
import { z } from "zod";
import type { Database } from "@azure/cosmos";
import { sourceContainers } from "./config.js";
import { CosmosSimilarityStore, findSimilarQuestions, similarityPurgeWindow, type SimilarityStore } from "./search.js";
import { similarityAllTag, similarityPurgeTags } from "./cache-tags.js";
import { createSimilarityResultStore } from "./result-store.js";
import type { QuestionReference } from "./types.js";

export type TagInvalidator = (tags: string[]) => Promise<boolean>;

export async function purgeQuestionSimilarity(
  reference: QuestionReference,
  store: SimilarityStore,
  invalidate: TagInvalidator,
) {
  // Purging the question's own tag clears every stored result that already lists it; its nearest
  // neighbours are purged too because their results may now include it.
  const result = await findSimilarQuestions(reference, undefined, store, [], { unrestricted: true, limit: similarityPurgeWindow });
  const tags = similarityPurgeTags(reference, result.matches);
  const purged = await invalidate(tags);
  return { purged, tags: tags.length, neighbours: result.matches.length };
}

const purgeSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({
    sourceContainer: z.enum(sourceContainers),
    questionId: z.string().trim().min(1).max(128).regex(/^[^/\\?#]+$/),
  }),
]);

export function createSimilarityCacheAdminRouter(database: Database) {
  const router = express.Router();
  const store = new CosmosSimilarityStore(database);
  const resultStore = createSimilarityResultStore(database);
  const invalidate: TagInvalidator = async tags => (await resultStore.purge(tags)) > 0;
  router.post("/purge", async (req, res) => {
    const parsed = purgeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Provide a question (sourceContainer and questionId) or all: true." });
    try {
      if ("all" in parsed.data) {
        const purged = await invalidate([similarityAllTag]);
        return res.json({ purged, scope: "all" });
      }
      const { sourceContainer, questionId } = parsed.data;
      return res.json({ ...(await purgeQuestionSimilarity({ sourceContainer, questionId }, store, invalidate)), scope: "question" });
    } catch (error) {
      console.error("Similarity cache purge failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not purge the similarity cache." });
    }
  });
  return router;
}
