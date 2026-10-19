import type { ContainerDefinition } from "@azure/cosmos";
import { z } from "zod";

export const masterContainerId = "subject_topic_master";

const text = z.string().trim().min(1);
const subjectId = z.string().regex(/^S\d+$/);
const topicId = z.string().regex(/^S\d+-T\d+$/);
const common = {
  subjectId,
  name: text,
  sortOrder: z.number().int().positive(),
  isActive: z.boolean(),
  schemaVersion: z.literal("1"),
  sourceRevision: text,
  legacyIds: z.array(text),
  retirement: z.object({
    reason: text,
    replacementIds: z.array(topicId).min(1),
    requiresReview: z.literal(true),
  }).optional(),
};

export const masterRecordSchema = z.discriminatedUnion("type", [
  z.object({
    ...common,
    id: subjectId,
    type: z.literal("subject"),
    parentId: z.null(),
    description: text,
  }).refine(record => record.id === record.subjectId, "A subject must use its own ID as its partition key."),
  z.object({
    ...common,
    id: topicId,
    type: z.literal("topic"),
    parentId: subjectId,
    details: z.array(text),
  }).refine(record =>
    record.parentId === record.subjectId && record.id.startsWith(`${record.subjectId}-T`),
  "A topic must belong to its parent subject and partition."),
]).refine(record => record.isActive ? !record.retirement : !!record.retirement,
  "Inactive master records require retirement instructions; active records must not have them.");

const sourceSchema = z.object({
  version: text,
  subjects: z.array(z.object({
    id: subjectId,
    name: text,
    boundary: text,
    sourceRevision: text.optional(),
    mergedFromSubjectIds: z.array(subjectId).optional(),
    topics: z.array(z.object({
      id: topicId,
      name: text,
      sourceRevision: text.optional(),
      legacyTopicIds: z.array(topicId).optional(),
      subtopics: z.array(text).optional(),
    })).min(1),
  })).min(1),
  retiredRecords: z.array(masterRecordSchema).default([]),
});

export type MasterRecord = z.infer<typeof masterRecordSchema>;

function normalized(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildMasterRecords(input: unknown): MasterRecord[] {
  const source = sourceSchema.parse(input);
  const records: MasterRecord[] = [];
  const ids = new Set<string>();
  const subjectNames = new Set<string>();
  const add = (record: MasterRecord) => {
    if (ids.has(record.id)) throw new Error(`Duplicate master ID: ${record.id}`);
    ids.add(record.id);
    records.push(record);
  };
  for (const [index, subject] of source.subjects.entries()) {
    const name = normalized(subject.name);
    if (subjectNames.has(name)) throw new Error(`Duplicate subject name: ${subject.name}`);
    subjectNames.add(name);
    add(masterRecordSchema.parse({
      id: subject.id,
      type: "subject",
      subjectId: subject.id,
      parentId: null,
      name: subject.name,
      description: subject.boundary,
      sortOrder: index + 1,
      isActive: true,
      schemaVersion: "1",
      sourceRevision: subject.sourceRevision ?? source.version,
      legacyIds: subject.mergedFromSubjectIds ?? [],
    }));
    const topicNames = new Set<string>();
    for (const [topicIndex, topic] of subject.topics.entries()) {
      const topicName = normalized(topic.name);
      if (topicNames.has(topicName)) throw new Error(`Duplicate topic under ${subject.id}: ${topic.name}`);
      topicNames.add(topicName);
      add(masterRecordSchema.parse({
        id: topic.id,
        type: "topic",
        subjectId: subject.id,
        parentId: subject.id,
        name: topic.name,
        sortOrder: topicIndex + 1,
        isActive: true,
        schemaVersion: "1",
        sourceRevision: topic.sourceRevision ?? subject.sourceRevision ?? source.version,
        legacyIds: (topic.legacyTopicIds ?? []).filter(id => id !== topic.id),
        details: topic.subtopics ?? [],
      }));
    }
  }
  const active = new Map(records.map(record => [record.id, record]));
  for (const record of source.retiredRecords) {
    if (record.isActive || record.type !== "topic" || !record.retirement || !active.has(record.subjectId)) {
      throw new Error(`Retired topic ${record.id} must be inactive and retain an active parent subject.`);
    }
    for (const replacementId of record.retirement.replacementIds) {
      if (active.get(replacementId)?.type !== "topic") {
        throw new Error(`Retired topic ${record.id} has an invalid replacement: ${replacementId}`);
      }
    }
    add(record);
  }
  return records;
}

export function sameMasterRecord(left: unknown, right: unknown): boolean {
  return JSON.stringify(masterRecordSchema.parse(left)) === JSON.stringify(masterRecordSchema.parse(right));
}

export function planMasterSeed(expected: MasterRecord[], existing: unknown[]) {
  const expectedIds = new Set(expected.map(record => record.id));
  if (expectedIds.size !== expected.length) throw new Error("The seed contains duplicate IDs.");
  const present = new Map<string, MasterRecord>();
  for (const value of existing) {
    const record = masterRecordSchema.parse(value);
    if (present.has(record.id)) throw new Error(`Duplicate stored master ID: ${record.id}`);
    if (!expectedIds.has(record.id)) throw new Error(`Unexpected master record ${record.id}; refusing to alter this catalogue.`);
    present.set(record.id, record);
  }

  const create: MasterRecord[] = [];
  let skipped = 0;
  for (const record of expected) {
    const stored = present.get(record.id);
    if (!stored) create.push(record);
    else if (sameMasterRecord(record, stored)) skipped++;
    else throw new Error(`Master record ${record.id} differs from the seed; no records will be overwritten.`);
  }
  return { create, skipped };
}

export function planMasterRevision(previous: MasterRecord[], expected: MasterRecord[], existing: unknown[]) {
  const old = new Map(previous.map(record => [record.id, record]));
  const next = new Map(expected.map(record => [record.id, record]));
  if (old.size !== previous.length || next.size !== expected.length) {
    throw new Error("The revision contains duplicate IDs.");
  }
  for (const record of previous) {
    const replacement = next.get(record.id);
    if (!replacement) throw new Error(`Retire ${record.id} explicitly instead of deleting it.`);
    if (replacement.subjectId !== record.subjectId || replacement.type !== record.type) {
      throw new Error(`Master record ${record.id} cannot change its type or partition.`);
    }
  }
  const stored = new Map<string, MasterRecord>();
  for (const value of existing) {
    const record = masterRecordSchema.parse(value);
    if (!next.has(record.id)) throw new Error(`Unexpected master record ${record.id}; revision blocked.`);
    if (stored.has(record.id)) throw new Error(`Duplicate stored master ID: ${record.id}`);
    stored.set(record.id, record);
  }
  const create: MasterRecord[] = [];
  const replace: { previous: MasterRecord; record: MasterRecord }[] = [];
  let skipped = 0;
  for (const record of expected) {
    const current = stored.get(record.id);
    const baseline = old.get(record.id);
    if (!current) {
      if (baseline) throw new Error(`Previously stored master record ${record.id} is missing; revision blocked.`);
      create.push(record);
    } else if (sameMasterRecord(current, record)) {
      skipped++;
    } else if (baseline && sameMasterRecord(current, baseline)) {
      replace.push({ previous: baseline, record });
    } else {
      throw new Error(`Master record ${record.id} has unexpected changes; revision blocked.`);
    }
  }
  return { create, replace, skipped };
}

export function validateMasterContainer(definition: ContainerDefinition): void {
  if (definition.id !== masterContainerId ||
      definition.partitionKey?.kind !== "Hash" ||
      definition.partitionKey.paths.length !== 1 ||
      definition.partitionKey.paths[0] !== "/subjectId") {
    throw new Error(`${masterContainerId} must use the /subjectId hash partition key. No policy was modified.`);
  }
}
