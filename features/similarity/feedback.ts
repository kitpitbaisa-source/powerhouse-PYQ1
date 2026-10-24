import { z } from "zod";
import type { Database } from "@azure/cosmos";
import { sourceContainers } from "./config.js";

export const feedbackReasons = ["not_related", "wrong_concept", "should_rank_higher", "too_broad", "other"] as const;

export const feedbackSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().min(1).max(64),
  matchProfileId: z.string().min(1).max(160),
  reason: z.enum(feedbackReasons),
  comment: z.string().trim().max(1000).optional(),
  score: z.number().finite().min(0).max(100),
  userKey: z.string().min(1).max(128),
});

export type SimilarityFeedback = z.infer<typeof feedbackSchema>;

let containerReady = false;

// One document per user and question pair, so changing a vote replaces it.
export async function saveSimilarityFeedback(database: Database, feedback: SimilarityFeedback, rankingVersion: string) {
  if (!containerReady) {
    await database.containers.createIfNotExists({ id: "similarity-feedback", partitionKey: { paths: ["/sourceKey"] } });
    containerReady = true;
  }
  const sourceKey = `${feedback.sourceContainer}:${feedback.questionId}`;
  await database.container("similarity-feedback").items.upsert({
    id: `${feedback.userKey}|${feedback.matchProfileId}`,
    sourceKey,
    ...feedback,
    rankingVersion,
    updatedAt: new Date().toISOString(),
  });
}
