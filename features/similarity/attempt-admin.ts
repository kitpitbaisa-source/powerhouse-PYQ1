import express from "express";
import type { Container } from "@azure/cosmos";

export interface SimilarityAttemptUser {
  email: string;
  questions: number;
  attempts: number;
  lastAt: string | null;
}

// Per-user totals of questions answered from the similarity popup (admin only; mounted under /api/admin).
export function createSimilarityAttemptsAdminRouter(userQuestions: Container) {
  const router = express.Router();
  router.get("/", async (_req, res) => {
    try {
      const { resources } = await userQuestions.items.query<{ userId: string; questions: number; attempts: number; lastAt?: string }>(
        "SELECT c.userId, COUNT(1) AS questions, SUM(c.similarityAttemptCount) AS attempts, MAX(c.lastSimilarityAt) AS lastAt " +
        "FROM c WHERE c.similarityAttemptCount > 0 GROUP BY c.userId"
      ).fetchAll();
      const users: SimilarityAttemptUser[] = resources
        .map(row => ({ email: row.userId, questions: row.questions, attempts: row.attempts, lastAt: row.lastAt ?? null }))
        .sort((a, b) => b.attempts - a.attempts);
      return res.json({
        users,
        totals: { users: users.length, questions: users.reduce((sum, user) => sum + user.questions, 0), attempts: users.reduce((sum, user) => sum + user.attempts, 0) },
      });
    } catch (error) {
      console.error("Similarity attempts summary failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not load similarity attempts." });
    }
  });
  return router;
}
