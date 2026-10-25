import express from "express";
import { z } from "zod";
import type { Database } from "@azure/cosmos";
import { sourceContainers } from "./config.js";

export const similarityUsageContainerId = "similarity-usage";
const anonymousEmail = "anonymous";

const emailSchema = z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+$/);
const referenceFields = {
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().trim().min(1).max(128),
};

export const matchClickSchema = z.object({
  ...referenceFields,
  email: emailSchema.optional(),
  matchProfileId: z.string().min(1).max(160),
  rank: z.number().int().min(1).max(50),
  score: z.number().finite().min(0).max(100),
  locked: z.boolean().optional(),
});

export type SimilarityUsageEvent =
  | {
      type: "open"; email?: string; sourceContainer: string; questionId: string;
      resultSource: "stored" | "computed"; status: string; durationMs: number;
    }
  | ({ type: "match_click" } & z.infer<typeof matchClickSchema>);

let containerReady = false;

export function createSimilarityUsageStore(database: Database) {
  return {
    // Usage logging must never break a search, so failures are only logged.
    async record(event: SimilarityUsageEvent): Promise<void> {
      try {
        if (!containerReady) {
          await database.containers.createIfNotExists({ id: similarityUsageContainerId, partitionKey: { paths: ["/email"] } });
          containerReady = true;
        }
        const at = new Date().toISOString();
        await database.container(similarityUsageContainerId).items.create({
          ...event, email: event.email ?? anonymousEmail, id: `${at}|${crypto.randomUUID()}`, at,
        });
      } catch (error) {
        console.warn("Similarity usage write failed:", error instanceof Error ? error.message : error);
      }
    },
    async summary(days: number) {
      if (!containerReady) {
        await database.containers.createIfNotExists({ id: similarityUsageContainerId, partitionKey: { paths: ["/email"] } });
        containerReady = true;
      }
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { resources } = await database.container(similarityUsageContainerId).items.query<Record<string, unknown>>({
        query: "SELECT c.type, c.email, c.sourceContainer, c.questionId, c.resultSource, c.durationMs, c.matchProfileId, c.rank, c.at FROM c WHERE c.at >= @since",
        parameters: [{ name: "@since", value: since }],
      }).fetchAll();
      return summarizeSimilarityUsage(resources, days);
    },
  };
}

type UsageRow = Record<string, unknown>;

const topCounts = (counts: Map<string, number>, limit: number) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

export function summarizeSimilarityUsage(rows: UsageRow[], days: number) {
  const opens = rows.filter(row => row.type === "open");
  const clicks = rows.filter(row => row.type === "match_click");
  const perUser = new Map<string, { opens: number; clicks: number; lastAt: string }>();
  const perQuestion = new Map<string, number>();
  const perMatch = new Map<string, number>();
  const touch = (row: UsageRow, field: "opens" | "clicks") => {
    const email = String(row.email ?? anonymousEmail);
    const entry = perUser.get(email) ?? { opens: 0, clicks: 0, lastAt: "" };
    entry[field] += 1;
    const at = String(row.at ?? "");
    if (at > entry.lastAt) entry.lastAt = at;
    perUser.set(email, entry);
  };
  for (const row of opens) {
    touch(row, "opens");
    const key = `${row.sourceContainer}:${row.questionId}`;
    perQuestion.set(key, (perQuestion.get(key) ?? 0) + 1);
  }
  for (const row of clicks) {
    touch(row, "clicks");
    const key = String(row.matchProfileId);
    perMatch.set(key, (perMatch.get(key) ?? 0) + 1);
  }
  const durations = opens.map(row => Number(row.durationMs)).filter(Number.isFinite).sort((a, b) => a - b);
  const storedOpens = opens.filter(row => row.resultSource === "stored").length;
  const percentile = (p: number) => durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * p))] : null;
  return {
    days,
    opens: opens.length,
    clicks: clicks.length,
    storedOpens,
    computedOpens: opens.length - storedOpens,
    medianMs: percentile(0.5),
    p90Ms: percentile(0.9),
    users: [...perUser.entries()]
      .map(([email, entry]) => ({ email, ...entry }))
      .sort((a, b) => b.opens + b.clicks - (a.opens + a.clicks))
      .slice(0, 50),
    topQuestions: topCounts(perQuestion, 10).map(([question, count]) => ({ question, count })),
    topMatches: topCounts(perMatch, 10).map(([match, count]) => ({ match, count })),
  };
}

export function createSimilarityUsageAdminRouter(database: Database) {
  const router = express.Router();
  const store = createSimilarityUsageStore(database);
  router.get("/", async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    try {
      return res.json(await store.summary(days));
    } catch (error) {
      console.error("Similarity usage summary failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not load similarity usage." });
    }
  });
  return router;
}
