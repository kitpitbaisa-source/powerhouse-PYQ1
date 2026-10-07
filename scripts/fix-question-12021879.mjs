import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = process.env.COSMOS_DATABASE || "pyqpowerhouse";
const questionId = "12021879";
const suffix = "Which of the statements given above are not correct?";

if (!key) {
  console.error("COSMOS_KEY is not set. Aborting.");
  process.exit(1);
}

const database = new CosmosClient({ endpoint, key }).database(databaseId);
const container = database.container("questions");
const { resource } = await container.item(questionId, questionId).read();

if (!resource) {
  throw new Error(`Question ${questionId} was not found.`);
}

if (!String(resource.question || "").includes(suffix)) {
  resource.question = `${String(resource.question || "").trim()}<br/>${suffix}`;
  const { _rid, _self, _etag, _attachments, _ts, ...document } = resource;
  await container.items.upsert(document);
}

await container.items.upsert({ id: "__cache_version__", version: Date.now() });
console.log(`Question ${questionId} now ends with: ${suffix}`);
