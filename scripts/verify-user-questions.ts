import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

// Read-only health check for the `user-questions` container (bookmarks, notes
// and attempt history). Does not read the retired `user-attempts` container.
// Run: npx tsx scripts/verify-user-questions.ts

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const container = client.database(databaseId).container("user-questions");

const one = async (query: string) => {
  const { resources } = await container.items.query(query).fetchAll();
  return resources[0];
};

const total = await one("SELECT VALUE COUNT(1) FROM c");
const users = await one("SELECT VALUE COUNT(1) FROM (SELECT DISTINCT VALUE c.userId FROM c) AS u");
const attempts = await one("SELECT VALUE SUM(c.attemptCount) FROM c");
const correct = await one("SELECT VALUE SUM(c.correctCount) FROM c");
const wrong = await one("SELECT VALUE SUM(c.wrongCount) FROM c");
const bookmarks = await one("SELECT VALUE COUNT(1) FROM c WHERE c.isBookmarked = true");
const notes = await one("SELECT VALUE COUNT(1) FROM c WHERE c.hasNote = true");
const inactive = await one("SELECT VALUE COUNT(1) FROM c WHERE c.isActive = false");
const drift = await one("SELECT VALUE COUNT(1) FROM c WHERE c.attemptCount != (c.correctCount + c.wrongCount)");

console.log("\n  user-questions");
console.log("  ------------------------------");
console.log(`  documents            ${total}`);
console.log(`  distinct users       ${users}`);
console.log(`  attempts recorded    ${attempts ?? 0}`);
console.log(`  correct / wrong      ${correct ?? 0} / ${wrong ?? 0}`);
console.log(`  bookmarked           ${bookmarks}`);
console.log(`  with notes           ${notes}`);
console.log(`  soft-deleted         ${inactive}`);

console.log("\n  integrity");
console.log("  ------------------------------");
console.log(
  drift === 0
    ? "  OK: attemptCount equals correctCount + wrongCount on every document."
    : `  DRIFT: ${drift} document(s) where attemptCount != correctCount + wrongCount.`
);
process.exit(0);
