import { z } from "zod";
import { createHash } from "node:crypto";
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

export function similarityFeedbackId(feedback: Pick<SimilarityFeedback, "sourceContainer" | "questionId" | "matchProfileId" | "userKey">) {
  const identity = [feedback.sourceContainer, feedback.questionId, feedback.matchProfileId, feedback.userKey];
  return `simfb-${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}

export function similarityFeedbackDocument(
  feedback: SimilarityFeedback, rankingVersion: string, updatedAt: string, createdAt = updatedAt,
) {
  return {
    ...feedback,
    id: similarityFeedbackId(feedback),
    feedbackType: "similarity" as const,
    sourceKey: `${feedback.sourceContainer}:${feedback.questionId}`,
    rankingVersion, createdAt, updatedAt,
  };
}

export function toAdminFeedback(document: Record<string, any>): Record<string, any> {
  if (document.feedbackType !== "similarity") return { ...document, feedbackType: document.feedbackType ?? "general" };
  return {
    ...document,
    questionType: "similarity",
    userAlias: document.userAlias || "Similarity user",
    createdAt: document.updatedAt || document.createdAt,
    comment: [
      `Reason: ${String(document.reason).replaceAll("_", " ")}`,
      `Match: ${document.sourceKey} -> ${document.matchProfileId}`,
      `Score: ${document.score}; ranking: ${document.rankingVersion}`,
      document.comment,
    ].filter(Boolean).join("\n"),
  };
}

// One document per user and question pair, so changing a vote replaces it.
export async function saveSimilarityFeedback(database: Database, feedback: SimilarityFeedback, rankingVersion: string) {
  if (!containerReady) {
    await database.containers.createIfNotExists({ id: "feedback", partitionKey: { paths: ["/id"] } });
    containerReady = true;
  }
  const container = database.container("feedback");
  const id = similarityFeedbackId(feedback);
  let previous: Record<string, any> | undefined;
  try {
    previous = (await container.item(id, id).read()).resource;
  } catch (error) {
    if (Number((error as { code?: number }).code) !== 404) throw error;
  }
  const now = new Date().toISOString();
  await container.items.upsert({
    ...similarityFeedbackDocument(feedback, rankingVersion, now, previous?.createdAt ?? now),
    ...(previous?.migration ? { migration: previous.migration } : {}),
  });
}
