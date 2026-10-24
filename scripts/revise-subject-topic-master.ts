import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { CosmosClient } from "@azure/cosmos";
import { readStorageConfig } from "../features/similarity/config";
import {
  buildMasterRecords, masterContainerId, planMasterRevision, planMasterSeed,
  sameMasterRecord, validateMasterContainer, type MasterRecord,
} from "../features/taxonomy/master";

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      file: { type: "string" },
      backup: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.from || !values.file || (values.apply && !values.backup)) {
    throw new Error("Usage: --from PREVIOUS_JSON --file REVISED_JSON [--apply --backup NEW_BACKUP_JSON]. Default is read-only.");
  }
  const previous = buildMasterRecords(JSON.parse(await readFile(values.from, "utf8")));
  const expected = buildMasterRecords(JSON.parse(await readFile(values.file, "utf8")));
  const config = readStorageConfig();
  const client = new CosmosClient({ endpoint: config.endpoint, key: config.key });
  try {
    const container = client.database(config.databaseId).container(masterContainerId);
    const { resource: definition } = await container.read();
    if (!definition) throw new Error("The master container is unavailable.");
    validateMasterContainer(definition);
    const { resources: existing } = await container.items.query<unknown>("SELECT * FROM c").fetchAll();
    const plan = planMasterRevision(previous, expected, existing);
    console.log(JSON.stringify({
      mode: values.apply ? "apply" : "read-only",
      create: plan.create.length,
      replace: plan.replace.length,
      unchanged: plan.skipped,
      activeSubjects: expected.filter(record => record.isActive && record.type === "subject").length,
      activeTopics: expected.filter(record => record.isActive && record.type === "topic").length,
      activeSubtopics: expected.filter(record => record.isActive && record.type === "subtopic").length,
      retired: expected.filter(record => !record.isActive).length,
    }));
    if (!values.apply) return;
    if (!values.backup) throw new Error("An unused backup path is required before writing.");
    await writeFile(values.backup, JSON.stringify({
      capturedAt: new Date().toISOString(), container: masterContainerId,
      previousFile: values.from, revisedFile: values.file, records: existing,
    }, null, 2), { flag: "wx" });
    const verify = async (record: MasterRecord) => {
      const { resource } = await container.item(record.id, record.subjectId).read<unknown>();
      if (!resource || !sameMasterRecord(resource, record)) {
        throw new Error(`Read-back verification failed for ${record.id}. The revision is incomplete.`);
      }
    };
    for (const record of plan.create) {
      await container.items.create(record);
      await verify(record);
    }
    for (const change of plan.replace) {
      const item = container.item(change.record.id, change.record.subjectId);
      const { resource, etag } = await item.read<unknown>();
      if (!resource || !sameMasterRecord(resource, change.previous) || !etag) {
        throw new Error(`Master record ${change.record.id} changed during the revision; stopped without overwriting it.`);
      }
      await item.replace(change.record, { accessCondition: { type: "IfMatch", condition: etag } });
      await verify(change.record);
    }
    const { resources: saved } = await container.items.query<unknown>("SELECT * FROM c").fetchAll();
    const verified = planMasterSeed(expected, saved);
    if (verified.create.length) throw new Error("The revision is incomplete. Rerun the preview before resuming.");
    console.log(JSON.stringify({
      verified: verified.skipped, backup: values.backup,
      sourceQuestionsProfilesConceptsAndEmbeddingsChanged: false,
    }));
  } finally {
    client.dispose();
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : "Master revision failed.";
  console.error(process.env.COSMOS_KEY ? message.replaceAll(process.env.COSMOS_KEY, "[REDACTED]") : message);
  process.exitCode = 1;
});
