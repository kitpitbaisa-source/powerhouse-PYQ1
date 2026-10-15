import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const endpoint = process.env.COSMOS_ENDPOINT || "https://pyqpowerhouse-db.documents.azure.com:443/";
const key = process.env.COSMOS_KEY || "";
const databaseId = process.env.COSMOS_DATABASE || "pyqpowerhouse";
const questionId = "2262";
const original = "Which of the following is/are correct about G20?<br/>1. It has no permanent secretariat.<br/>3. Each country is led by a Sherpa.<br/>4. Spain is a permanent invitee.";
const corrected = original.replace(
  "<br/>3.",
  "<br/>2. It was founded on a legally binding international agreement between 20 top industrialized countries.<br/>3."
);

if (!key) {
  throw new Error("COSMOS_KEY is not set. Aborting.");
}

const database = new CosmosClient({ endpoint, key }).database(databaseId);
const container = database.container("questions");
const item = container.item(questionId, questionId);
const { resource } = await item.read();

if (!resource) {
  throw new Error(`Question ${questionId} was not found.`);
}
if (resource.question !== original && resource.question !== corrected) {
  throw new Error(`Question ${questionId} has unexpected wording. Aborting.`);
}

if (resource.question === original) {
  await item.patch(
    [{ op: "replace", path: "/question", value: corrected }],
    { accessCondition: { type: "IfMatch", condition: resource._etag } }
  );
}

const { resource: verified } = await item.read();
if (verified?.question !== corrected) {
  throw new Error(`Question ${questionId} update could not be verified.`);
}

await container.items.upsert({ id: "__cache_version__", version: Date.now() });
console.log(`Question ${questionId} now includes statement 2.`);
