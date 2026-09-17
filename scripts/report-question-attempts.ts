import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

// Read-only report: how many times each question has actually been attempted,
// aggregated across every user, straight from the `user-questions` container.
// Run: npx tsx scripts/report-question-attempts.ts [limit]

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const limit = Math.max(1, Math.min(Number(process.argv[2] || 50), 1000));

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container("user-questions");

// GROUP BY runs cross-partition here on purpose: this is an admin-side report,
// not an app request path.
const { resources } = await container.items
  .query(
    "SELECT c.questionType, c.questionId, " +
      "COUNT(1) AS users, " +
      "SUM(c.attemptCount) AS attempts, " +
      "SUM(c.correctCount) AS correct, " +
      "SUM(c.wrongCount) AS wrong " +
      "FROM c WHERE c.isActive = true AND c.attemptCount > 0 " +
      "GROUP BY c.questionType, c.questionId"
  )
  .fetchAll();

resources.sort((a: any, b: any) => (b.attempts ?? 0) - (a.attempts ?? 0));

const totalAttempts = resources.reduce((sum: number, r: any) => sum + (r.attempts ?? 0), 0);
const totalCorrect = resources.reduce((sum: number, r: any) => sum + (r.correct ?? 0), 0);

console.log(`\n  Distinct questions attempted : ${resources.length}`);
console.log(`  Total attempts recorded      : ${totalAttempts}`);
console.log(
  `  Overall accuracy             : ${totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0}%`
);
console.log(`\n  Top ${Math.min(limit, resources.length)} most-attempted questions\n`);
console.log("  type      qid        users  attempts  correct  wrong  acc%");
console.log("  " + "-".repeat(62));

for (const r of resources.slice(0, limit) as any[]) {
  const attempts = r.attempts ?? 0;
  const correct = r.correct ?? 0;
  const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
  console.log(
    "  " +
      String(r.questionType ?? "-").padEnd(10) +
      String(r.questionId ?? "-").padEnd(11) +
      String(r.users ?? 0).padStart(5) +
      String(attempts).padStart(10) +
      String(correct).padStart(9) +
      String(r.wrong ?? 0).padStart(7) +
      String(acc).padStart(6)
  );
}

process.exit(0);
