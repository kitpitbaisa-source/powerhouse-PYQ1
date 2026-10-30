import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { StatisticsService, statisticsContainerId } from "../../features/statistics/service.js";

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
if (!endpoint || !key) throw new Error("COSMOS_ENDPOINT and COSMOS_KEY are required");
const directory = process.argv.find(arg => arg.startsWith("--backup-dir="))?.slice("--backup-dir=".length);
if (!directory || !path.isAbsolute(directory)) throw new Error("Pass an absolute --backup-dir for the initialization audit");
mkdirSync(directory, { recursive: true });
const database = new CosmosClient({ endpoint, key }).database("pyqpowerhouse");
const service = new StatisticsService(database);
await service.ensure();
const { resources: previous } = await service.summaries.items.query("SELECT * FROM c").fetchAll();
const stamp = Date.now();
writeFileSync(path.join(directory, `statistics-before-${stamp}.json`), JSON.stringify(previous), { flag: "wx" });

const { resources: records } = await database.container("user-questions").items.query<{
  userId: string; questionId: string | number; questionType: string; attemptCount: number;
}>("SELECT c.userId,c.questionId,c.questionType,c.attemptCount FROM c WHERE c.attemptCount > 0").fetchAll();
const users = [...new Set(records.map(record => record.userId))].sort();
const sources: Record<string, string[]> = {
  prelims: ["questions", "state_pcs"], mains: ["mains-questions"], essay: ["essay-questions"],
  csat: ["csat-questions"], english: ["english-questions"],
};
for (const [type, names] of Object.entries(sources)) {
  const ids = [...new Set(records.filter(record => record.questionType === type).map(record => String(record.questionId)))];
  const resolved = new Set<string>();
  for (const name of names) {
    for (let offset = 0; offset < ids.length; offset += 200) {
      const { resources } = await database.container(name).items.query<{
        id: string; exam: string; year?: string; subject?: string;
      }>({
        query: "SELECT c.id,c.exam,c.year,c.subject FROM c WHERE ARRAY_CONTAINS(@ids,c.id)",
        parameters: [{ name: "@ids", value: ids.slice(offset, offset + 200) }],
      }).fetchAll();
      for (const metadata of resources) {
        if (!resolved.has(metadata.id)) service.primeQuestion(type, metadata.id, metadata);
        resolved.add(metadata.id);
      }
    }
  }
}

const report: { users: number; verified: number; totalAttempts: number; failures: { userId: string; reason: string }[] } = {
  users: users.length, verified: 0, totalAttempts: 0, failures: [],
};
const journal = path.join(directory, `statistics-initialization-${stamp}.jsonl`);
for (const userId of users) {
  try {
    const expected = await service.seed(userId);
    const { resource: saved } = await database.container(statisticsContainerId).item("overall", userId).read();
    for (const field of ["totalAttempts", "correctAttempts", "wrongAttempts", "currentStreak", "maxStreak", "accuracy"]) {
      if (saved?.[field] !== expected[field as keyof typeof expected]) throw new Error(`Read-back mismatch: ${field}`);
    }
    if (JSON.stringify(saved?.exams) !== JSON.stringify(expected.exams)) throw new Error("Exam totals read-back mismatch");
    report.verified++;
    report.totalAttempts += expected.totalAttempts;
    appendFileSync(journal, JSON.stringify({ userId, status: "verified", totalAttempts: expected.totalAttempts }) + "\n");
    if (report.verified % 20 === 0) console.log(`Initialized ${report.verified}/${users.length} users`);
  } catch (caught) {
    const failure = { userId, reason: caught instanceof Error ? caught.message : String(caught) };
    report.failures.push(failure);
    appendFileSync(journal, JSON.stringify({ ...failure, status: "needs-review" }) + "\n");
  }
}
writeFileSync(path.join(directory, `statistics-initialization-report-${stamp}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
