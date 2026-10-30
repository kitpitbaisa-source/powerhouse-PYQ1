import { Router } from "express";
import type { Database } from "@azure/cosmos";
import { publicUserId, type Totals, type UserStatistics } from "./model.js";
import { StatisticsService } from "./service.js";
import { devSamplesEnabled, isSampleUser, sampleLearners } from "./dev-sample-learners.js";

type Metric = "correct" | "attempts" | "accuracy" | "maxStreak" | "currentStreak";
interface Profile { email: string; alias?: string; isActive?: boolean; avatarHash?: string }
export interface LeaderboardEntry extends Totals {
  id: string;
  alias: string;
  avatarUrl: string | null;
  rank: number;
  currentStreak?: number;
  maxStreak?: number;
  isYou: boolean;
  isSample?: boolean;
  accuracyQualified: boolean;
  examBreakdown: { exam: string; attempts: number }[];
}

export interface LeaderboardHighlights {
  attempts: LeaderboardEntry[];
  accuracy: LeaderboardEntry[];
  maxStreak: LeaderboardEntry[];
}

export function rankLeaderboard(
  summaries: UserStatistics[], profiles: Profile[], exam: string, metric: Metric, viewer?: string,
): LeaderboardEntry[] {
  const directory = new Map(profiles.map(profile => [profile.email, profile]));
  const entries = summaries.flatMap(summary => {
    const profile = directory.get(summary.userId);
    if (profile?.isActive === false) return [];
    const totals = exam === "all" ? summary : Object.values(summary.exams).find(item => item.exam === exam);
    if (!totals?.totalAttempts) return [];
    const alias = profile?.alias?.trim() || `Learner ${summary.publicId.slice(0, 5).toUpperCase()}`;
    return [{
      id: summary.publicId, alias,
      avatarUrl: profile?.avatarHash ? `/api/leaderboard/avatar/${summary.publicId}/${profile.avatarHash}` : null,
      totalAttempts: totals.totalAttempts, correctAttempts: totals.correctAttempts,
      wrongAttempts: totals.wrongAttempts, accuracy: totals.accuracy,
      accuracyQualified: totals.totalAttempts >= 100,
      examBreakdown: Object.values(summary.exams)
        .filter(item => item.totalAttempts > 0)
        .map(item => ({ exam: item.exam, attempts: item.totalAttempts }))
        .sort((a, b) => b.attempts - a.attempts || a.exam.localeCompare(b.exam)),
      ...(exam === "all" ? { currentStreak: summary.currentStreak, maxStreak: summary.maxStreak } : {}),
      rank: 0, isYou: summary.userId === viewer, isSample: isSampleUser(summary.userId),
    }];
  });
  const value = (entry: LeaderboardEntry) => metric === "correct" ? entry.correctAttempts :
    metric === "attempts" ? entry.totalAttempts : metric === "accuracy" ? entry.accuracy :
    entry[metric] || 0;
  entries.sort((a, b) => (metric === "accuracy" ? Number(b.accuracyQualified) - Number(a.accuracyQualified) : 0) ||
    value(b) - value(a) || b.correctAttempts - a.correctAttempts ||
    b.accuracy - a.accuracy || b.totalAttempts - a.totalAttempts || a.id.localeCompare(b.id));
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getLeaderboardHighlights(
  summaries: UserStatistics[], profiles: Profile[], exam: string, viewer?: string,
): LeaderboardHighlights {
  return {
    attempts: rankLeaderboard(summaries, profiles, exam, "attempts", viewer).slice(0, 3),
    accuracy: rankLeaderboard(summaries, profiles, exam, "accuracy", viewer).filter(entry => entry.accuracyQualified).slice(0, 3),
    maxStreak: rankLeaderboard(summaries, profiles, "all", "maxStreak", viewer).slice(0, 3),
  };
}

export function createLeaderboardRouter(database: Database, service: StatisticsService) {
  const router = Router();
  let directory: Profile[] = [];
  let directoryAt = 0;
  async function profiles(): Promise<Profile[]> {
    if (Date.now() - directoryAt < 60_000) return directory;
    const { resources } = await database.container("users").items.query<Profile>(
      "SELECT c.email,c.alias,c.isActive,c.avatar.sha256 AS avatarHash FROM c"
    ).fetchAll();
    directory = resources;
    directoryAt = Date.now();
    return directory;
  }
  router.get("/me", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
    if (!email || email.length > 320) return res.status(400).json({ error: "email is required" });
    try {
      await service.ensure();
      const { resource } = await service.summaries.item("overall", email).read<UserStatistics>();
      return res.json({ currentStreak: resource?.currentStreak ?? 0 });
    } catch (caught: any) {
      if (caught.code === 404) return res.json({ currentStreak: 0 });
      return res.status(503).json({ error: "Your current streak is temporarily unavailable." });
    }
  });
  router.get("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const exam = typeof req.query.exam === "string" ? req.query.exam : "all";
    const metric = (req.query.sort || "correct") as Metric;
    const page = Number(req.query.page || 1);
    if (!["correct", "attempts", "accuracy", "maxStreak", "currentStreak"].includes(metric) ||
      (exam !== "all" && ["maxStreak", "currentStreak"].includes(metric)) ||
      !Number.isInteger(page) || page < 1 || page > 1000 || exam.length > 200) {
      return res.status(400).json({ error: "Invalid leaderboard filters" });
    }
    try {
      await service.ensure();
      const retries = await service.repair(3);
      const { resources } = await service.summaries.items.query<UserStatistics>(
        "SELECT * FROM c WHERE c.type = 'user-statistics'"
      ).fetchAll();
      const exams = [...new Set(resources.flatMap(summary => Object.values(summary.exams).map(item => item.exam)))].sort();
      const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : undefined;
      let directory = await profiles();
      if (devSamplesEnabled()) {
        const samples = sampleLearners(exams);
        resources.push(...samples.summaries);
        directory = [...directory, ...samples.profiles];
      }
      const ranked = rankLeaderboard(resources, directory, exam, metric, email);
      const pageSize = 25;
      return res.json({
        entries: ranked.slice((page - 1) * pageSize, page * pageSize),
        total: ranked.length, realTotal: ranked.filter(entry => !entry.isSample).length, page, pageSize, exams, exam, sort: metric,
        me: ranked.find(entry => entry.isYou) || null,
        highlights: getLeaderboardHighlights(resources, directory, exam, email),
        updatedAt: resources.map(summary => summary.updatedAt).sort().at(-1) || null,
        pendingUpdates: retries.pending > 0,
      });
    } catch (caught) {
      console.error("Leaderboard failed:", caught instanceof Error ? caught.message : caught);
      return res.status(503).json({ error: "The leaderboard is temporarily unavailable. Please try again." });
    }
  });
  router.get("/avatar/:id/:hash", async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id) || !/^[a-f0-9]{64}$/.test(req.params.hash)) return res.sendStatus(404);
    try {
      const profile = (await profiles()).find(user => user.isActive !== false &&
        publicUserId(user.email) === req.params.id && user.avatarHash === req.params.hash);
      if (!profile) return res.sendStatus(404);
      const { resource } = await database.container("users").item(profile.email, profile.email).read();
      const avatar = resource?.avatar;
      if (avatar?.mimeType !== "image/png" || avatar.sha256 !== req.params.hash ||
        typeof avatar.dataUrl !== "string" || !avatar.dataUrl.startsWith("data:image/png;base64,")) return res.sendStatus(404);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(Buffer.from(avatar.dataUrl.slice("data:image/png;base64,".length), "base64"));
    } catch {
      return res.sendStatus(404);
    }
  });
  return router;
}
