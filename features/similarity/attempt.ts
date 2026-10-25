import { z } from "zod";
import { sourceContainers } from "./config.js";

const similarityAttemptSchema = z.object({
  role: z.enum(["origin", "match"]),
  source: z.object({
    sourceContainer: z.enum(sourceContainers),
    questionId: z.string().trim().min(1).max(128),
  }),
  matchScore: z.number().finite().min(0).max(100).optional(),
  matchRank: z.number().int().min(1).max(50).optional(),
});

// Extra fields stored on an attempt that was answered from the similarity popup.
// "origin" is the question the popup was opened for; "match" is one of its similar questions.
export function similarityAttemptFields(input: unknown): Record<string, unknown> | undefined {
  const parsed = similarityAttemptSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const { role, source, matchScore, matchRank } = parsed.data;
  return {
    via: "similarity",
    similarityRole: role,
    similaritySource: source,
    ...(role === "match" && matchScore !== undefined ? { matchScore: Math.round(matchScore) } : {}),
    ...(role === "match" && matchRank !== undefined ? { matchRank } : {}),
  };
}
