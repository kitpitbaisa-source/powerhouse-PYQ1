import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

// Read-only audit: finds question documents missing the fields the UI assumes
// are always present. Run: npx tsx scripts/audit-questions.ts

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = "pyqpowerhouse";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(databaseId);

const containers = ["questions", "state_pcs", "csat-questions", "english-questions"];

for (const containerId of containers) {
  const container = database.container(containerId);
  try {
    const { resources: total } = await container.items.query("SELECT VALUE COUNT(1) FROM c").fetchAll();
    const { resources: bad } = await container.items
      .query(
        "SELECT c.id, c.year, c.subject, c.exam FROM c " +
          "WHERE NOT IS_STRING(c.exam) OR NOT IS_STRING(c.subject) OR NOT IS_STRING(c.year)"
      )
      .fetchAll();

    console.log(`\n  ${containerId}: ${total[0]} docs, ${bad.length} malformed`);
    for (const doc of bad.slice(0, 20)) {
      console.log(
        `    id=${doc.id}  year=${JSON.stringify(doc.year)}  subject=${JSON.stringify(doc.subject)}  exam=${JSON.stringify(doc.exam)}`
      );
    }
    if (bad.length > 20) console.log(`    ...and ${bad.length - 20} more`);
  } catch (error: any) {
    console.log(`\n  ${containerId}: skipped (${error.code || error.message})`);
  }
}

process.exit(0);
