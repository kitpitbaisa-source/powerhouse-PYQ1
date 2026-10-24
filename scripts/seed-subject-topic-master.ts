import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { CosmosClient, PartitionKeyKind, type Container } from "@azure/cosmos";
import { readStorageConfig } from "../features/similarity/config";
import { statusCode } from "../features/similarity/repository";
import {
  buildMasterRecords, masterContainerId, planMasterSeed, sameMasterRecord, validateMasterContainer,
} from "../features/taxonomy/master";

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      create: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(`npx tsx scripts/seed-subject-topic-master.ts --file PATH [--create]
Default: validate the catalogue and preview missing records without writes.
--create creates subject_topic_master and inserts missing subject/topic/subtopic records.
Requires existing shared database throughput; never provisions dedicated throughput.
Existing different or unexpected records stop the seed; no records are overwritten.
Legacy subtopics strings remain descriptive details. subtopicRecords create stable child records.
Source questions, concepts, profiles and embeddings are never written.`);
    return;
  }
  if (!values.file?.trim()) throw new Error("--file is required.");
  const records = buildMasterRecords(JSON.parse(await readFile(values.file, "utf8")));
  const config = readStorageConfig();
  const client = new CosmosClient({ endpoint: config.endpoint, key: config.key });
  try {
    const database = client.database(config.databaseId);
    let container: Container | undefined;
    const target = database.container(masterContainerId);
    try {
      const { resource } = await target.read();
      if (!resource) throw new Error("Cosmos did not return the master container definition.");
      validateMasterContainer(resource);
      container = target;
    } catch (error) {
      if (statusCode(error) !== 404) throw error;
    }
    if (!container && values.create) {
      let shared = false;
      try {
        const { resource } = await database.readOffer();
        shared = !!resource;
      } catch (error) {
        if (statusCode(error) !== 404) throw error;
      }
      if (!shared) throw new Error("Shared database throughput was not found. No dedicated throughput or container was provisioned.");
      await database.containers.createIfNotExists({
        id: masterContainerId,
        partitionKey: { paths: ["/subjectId"], kind: PartitionKeyKind.Hash },
      });
      const { resource } = await target.read();
      if (!resource) throw new Error("The new master container could not be read back.");
      validateMasterContainer(resource);
      container = target;
    }
    const existing = container
      ? (await container.items.query<unknown>("SELECT * FROM c").fetchAll()).resources
      : [];
    const plan = planMasterSeed(records, existing);
    console.log(JSON.stringify({
      mode: values.create ? "seed" : "read-only preview",
      container: masterContainerId,
      subjects: records.filter(record => record.isActive && record.type === "subject").length,
      topics: records.filter(record => record.isActive && record.type === "topic").length,
      subtopics: records.filter(record => record.isActive && record.type === "subtopic").length,
      retired: records.filter(record => !record.isActive).length,
      create: plan.create.length,
      unchanged: plan.skipped,
    }));
    if (!values.create) return;
    if (!container) throw new Error("Master container is unavailable; no records were written.");
    let created = 0;
    let concurrentMatches = 0;
    for (const record of plan.create) {
      try {
        await container.items.create(record);
        created++;
      } catch (error) {
        if (statusCode(error) !== 409) throw error;
        concurrentMatches++;
      }
      const { resource } = await container.item(record.id, record.subjectId).read<unknown>();
      if (!resource || !sameMasterRecord(record, resource)) {
        throw new Error(`Master record ${record.id} could not be verified after creation. No existing records were overwritten.`);
      }
      if ((created + concurrentMatches) % 25 === 0) console.log(`Verified ${created + concurrentMatches}/${plan.create.length} missing records.`);
    }
    const { resources: saved } = await container.items.query<unknown>("SELECT * FROM c").fetchAll();
    const verified = planMasterSeed(records, saved);
    if (verified.create.length) throw new Error("Master verification found missing records; rerun the seed to resume.");
    console.log(JSON.stringify({
      container: masterContainerId,
      created,
      unchanged: plan.skipped + concurrentMatches,
      verified: verified.skipped,
      detailItems: records.reduce((count, record) => count + (record.isActive && record.type === "topic" ? record.details.length : 0), 0),
      sourceQuestionsAndEmbeddingsChanged: false,
    }));
  } finally {
    client.dispose();
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : "Subject/topic master setup failed.";
  console.error(process.env.COSMOS_KEY ? message.replaceAll(process.env.COSMOS_KEY, "[REDACTED]") : message);
  process.exitCode = 1;
});
