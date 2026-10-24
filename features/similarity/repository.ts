import {
  CosmosClient, PartitionKeyKind, VectorEmbeddingDataType,
  VectorEmbeddingDistanceFunction, VectorIndexType,
  type ContainerDefinition, type Database,
} from "@azure/cosmos";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { masterContainerId, masterRecordSchema } from "../taxonomy/master.js";
import { conceptsContainerId, profileContainerId, provisionalProfileContainerId, readStorageConfig, sourceContainers } from "./config.js";
import {
  canonicalConceptSchema, classificationTaxonomyIssue, sourceQuestionSchema, storedProfileSchema,
  type SourceQuestion, type StoredProfile,
} from "./schema.js";
import type { CanonicalConcept, QuestionReference, QuestionSourceContainer } from "./types.js";
import { hashContent } from "./content-hash.js";
import { registryFingerprint } from "./concept-review.js";
import {
  QuestionVerificationConflictError, questionVerificationSchema, type QuestionVerification,
} from "./verification.js";

export interface ProfileSnapshot {
  document: StoredProfile;
  etag: string;
}

export interface SourceQuestionSnapshot {
  question: SourceQuestion;
  verification?: QuestionVerification;
  etag: string;
}

export interface PipelineRepository {
  readQuestion(reference: QuestionReference): Promise<SourceQuestion>;
  readQuestionSnapshot(reference: QuestionReference): Promise<SourceQuestionSnapshot>;
  saveQuestionVerification(
    reference: QuestionReference, verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot>;
  saveQuestionClassification(
    reference: QuestionReference, labels: { subject: string; topic: string },
    verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot>;
  readProfile(id: string): Promise<ProfileSnapshot | undefined>;
  saveProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot>;
  readProvisionalProfile?(id: string): Promise<ProfileSnapshot | undefined>;
  saveProvisionalProfile?(document: StoredProfile, etag?: string): Promise<ProfileSnapshot>;
  saveSubtopicProfile(document: StoredProfile, etag: string): Promise<ProfileSnapshot>;
  listConcepts(): Promise<CanonicalConcept[]>;
  withConceptRegistry<T>(action: (session: ConceptRegistrySession) => Promise<T>): Promise<T>;
  readMasterClassification(subjectId: string, topicId: string, subtopicIds?: readonly string[]): Promise<{
    subject: string; topic: string; subtopics?: { id: string; name: string }[];
  } | undefined>;
}

export interface ConceptRegistrySession {
  concepts: CanonicalConcept[];
  createConcept(concept: CanonicalConcept): Promise<CanonicalConcept>;
}

const classificationUpdateSchema = z.object({
  expected: canonicalConceptSchema,
  subjectId: z.string().regex(/^S\d+$/),
  topicId: z.string().regex(/^S\d+-T\d+$/),
  allowedProfileIds: z.array(z.string().min(1)).min(1),
  reviewedBy: z.string().trim().min(1),
  auditReference: z.string().trim().min(1),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  evidence: z.array(z.string().trim().min(1)).min(1),
});

export type ConceptClassificationUpdate = z.infer<typeof classificationUpdateSchema>;

const isolatedClassificationUpdateSchema = classificationUpdateSchema.pick({
  expected: true, subjectId: true, topicId: true, reviewedBy: true, auditReference: true, evidence: true,
}).extend({
  mode: z.literal("isolated_definition_only"),
  subject: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  definitionEvidence: z.string().min(1).refine(value => value.trim().length > 0),
  expectedConceptEtag: z.string().min(1),
  expectedRegistryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  proposalsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type IsolatedConceptClassificationUpdate = z.infer<typeof isolatedClassificationUpdateSchema>;

const coordinatedSourceEvidenceSchema = z.object({
  field: z.enum(["question", "option", "explanation"]),
  option_index: z.number().int().nonnegative().optional(),
  exact_text: z.string().min(1).refine(value => value.trim().length > 0),
}).strict().refine(value => (value.field === "option") === (value.option_index !== undefined),
  "Only option evidence requires an option_index.");
const coordinatedClassificationUpdateSchema = isolatedClassificationUpdateSchema.omit({ mode: true }).extend({
  expected: canonicalConceptSchema.strict(),
  dependencies: z.array(z.object({
    profileId: z.string().min(1),
    profileEtag: z.string().min(1),
    profileHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceEtag: z.string().min(1),
    sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceSnapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceEvidence: z.array(coordinatedSourceEvidenceSchema).min(1)
      .refine(values => values.some(value => value.field !== "explanation"),
        "A dependency requires question or option evidence."),
    meaningScopeRationale: z.string().trim().min(1),
  }).strict()),
  parentDependencies: z.array(z.object({
    expected: canonicalConceptSchema.strict(),
    expectedConceptEtag: z.string().min(1),
    meaningScopeRationale: z.string().trim().min(1),
  }).strict()),
}).strict();
export type CoordinatedConceptClassificationUpdate = z.infer<typeof coordinatedClassificationUpdateSchema>;

const consolidationUpdateSchema = z.object({
  expected: canonicalConceptSchema,
  replacement: canonicalConceptSchema,
  allowedProfileIds: z.array(z.string().min(1)).min(1),
  reviewedBy: z.string().trim().min(1),
  reviewedAt: z.iso.datetime(),
  auditReference: z.string().trim().min(1),
  proposalsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  evidence: z.array(z.string().trim().min(1)).min(1),
});

export type ConceptConsolidationUpdate = z.infer<typeof consolidationUpdateSchema>;

export interface ClassificationRegistrySession extends ConceptRegistrySession {
  reclassifyConcept(update: ConceptClassificationUpdate): Promise<CanonicalConcept>;
  reclassifyIsolatedConcept(update: IsolatedConceptClassificationUpdate): Promise<CanonicalConcept>;
  reclassifyCoordinatedConcept(update: CoordinatedConceptClassificationUpdate): Promise<CanonicalConcept>;
  reclassifyCoordinatedBatch(updates: CoordinatedConceptClassificationUpdate[]): Promise<CanonicalConcept[]>;
  consolidateConcept(update: ConceptConsolidationUpdate): Promise<CanonicalConcept>;
}

export const conceptRegistryLockId = "__concept_registry_coordinator__";
const registryLockSchema = z.object({
  id: z.literal(conceptRegistryLockId),
  owner: z.string().uuid(),
  acquiredAt: z.iso.datetime(),
  proposals: z.array(canonicalConceptSchema),
  classificationUpdates: z.array(classificationUpdateSchema.extend({
    proposed: canonicalConceptSchema,
  })).optional(),
  isolatedClassificationUpdates: z.array(isolatedClassificationUpdateSchema.extend({
    proposed: canonicalConceptSchema,
  })).optional(),
  coordinatedClassificationUpdates: z.array(coordinatedClassificationUpdateSchema.extend({
    proposed: canonicalConceptSchema,
    batchId: z.string().uuid().optional(),
  })).optional(),
  consolidationUpdates: z.array(consolidationUpdateSchema.extend({
    proposed: canonicalConceptSchema,
  })).optional(),
});

export function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = "status" in error ? error.status : "code" in error ? error.code : undefined;
  return typeof code === "number" ? code : undefined;
}

export function profileContainerDefinition(dimensions: number): ContainerDefinition {
  return {
    id: profileContainerId,
    partitionKey: { paths: ["/id"], kind: PartitionKeyKind.Hash },
    vectorEmbeddingPolicy: {
      vectorEmbeddings: [{
        path: "/embedding",
        dataType: VectorEmbeddingDataType.Float32,
        dimensions,
        distanceFunction: VectorEmbeddingDistanceFunction.Cosine,
      }],
    },
    indexingPolicy: {
      automatic: true,
      includedPaths: [{ path: "/*" }],
      excludedPaths: [{ path: "/embedding/*" }],
      vectorIndexes: [{ path: "/embedding", type: VectorIndexType.QuantizedFlat }],
    },
  };
}

export function validateProfileContainer(definition: ContainerDefinition, dimensions: number): void {
  const vector = definition.vectorEmbeddingPolicy?.vectorEmbeddings.find(item => item.path === "/embedding");
  if (definition.partitionKey?.paths.length !== 1 || definition.partitionKey.paths[0] !== "/id" ||
      !vector || vector.dimensions !== dimensions ||
      vector.dataType !== VectorEmbeddingDataType.Float32 ||
      vector.distanceFunction !== VectorEmbeddingDistanceFunction.Cosine ||
      !definition.indexingPolicy?.vectorIndexes?.some(index =>
        index.path === "/embedding" && index.type === VectorIndexType.QuantizedFlat) ||
      !definition.indexingPolicy.excludedPaths?.some(path => path.path === "/embedding/*")) {
    throw new Error(`${profileContainerId} has an incompatible partition/vector/index policy. No policy was modified.`);
  }
}

export async function ensureContainers(
  database: Database, dimensions: number, create: boolean, profileThroughput?: number,
): Promise<void> {
  if (profileThroughput !== undefined &&
      (!create || !Number.isSafeInteger(profileThroughput) || profileThroughput < 400 || profileThroughput % 100 !== 0)) {
    throw new Error("Profile throughput requires --create and must be at least 400 RU/s in increments of 100.");
  }
  await database.read();
  if (create) {
    await database.containers.createIfNotExists({
      ...profileContainerDefinition(dimensions),
      ...(profileThroughput === undefined ? {} : { throughput: profileThroughput }),
    });
  }
  const { resource: profile } = await database.container(profileContainerId).read();
  if (!profile) throw new Error(`${profileContainerId} was not found. Run similarity:setup -- --create.`);
  validateProfileContainer(profile, dimensions);
  if (profileThroughput !== undefined) {
    const { resource: offer } = await database.container(profileContainerId).readOffer();
    if (offer?.content?.offerThroughput !== profileThroughput) {
      throw new Error(`${profileContainerId} does not have the requested dedicated ${profileThroughput} RU/s. No existing throughput was modified.`);
    }
  }
  if (create) {
    await database.containers.createIfNotExists({
      id: conceptsContainerId,
      partitionKey: { paths: ["/id"], kind: PartitionKeyKind.Hash },
    });
  }
  const { resource: concepts } = await database.container(conceptsContainerId).read();
  if (!concepts || concepts.partitionKey?.paths.length !== 1 || concepts.partitionKey.paths[0] !== "/id") {
    throw new Error("The concepts container must exist and use /id as its partition key.");
  }
}

const etagSchema = z.object({ _etag: z.string().min(1) });

export class CosmosPipelineRepository implements PipelineRepository {
  constructor(readonly database: Database, private readonly coordinationTimeoutMs = 120_000) {}

  async readQuestion(reference: QuestionReference): Promise<SourceQuestion> {
    return (await this.readQuestionSnapshot(reference)).question;
  }

  async readQuestionSnapshot(reference: QuestionReference): Promise<SourceQuestionSnapshot> {
    const { resource } = await this.database.container(reference.sourceContainer)
      .item(reference.questionId, reference.questionId).read<unknown>();
    if (!resource) throw new Error(`Source question ${reference.sourceContainer}:${reference.questionId} was not found.`);
    const question = sourceQuestionSchema.parse(resource);
    if (!question.isActive || question.id === "__cache_version__" || question.question.startsWith("Q_")) {
      throw new Error(`Source question ${reference.sourceContainer}:${reference.questionId} is not active content.`);
    }
    if (question.id !== reference.questionId) throw new Error("Source question identity does not match its reference.");
    return {
      question, etag: etagSchema.parse(resource)._etag,
      verification: z.object({ verification: questionVerificationSchema.optional() }).parse(resource).verification,
    };
  }

  async saveQuestionVerification(
    reference: QuestionReference, verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot> {
    const data = questionVerificationSchema.parse(verification);
    const current = await this.readQuestionSnapshot(reference);
    if (hashContent(expected.question) !== data.sourceContentHash ||
        hashContent(current.question) !== data.sourceContentHash) {
      throw new QuestionVerificationConflictError(`Source question ${reference.sourceContainer}:${reference.questionId} changed before its verification could be saved.`);
    }
    if (JSON.stringify(current.verification) === JSON.stringify(data)) return current;
    if (current.etag !== expected.etag) {
      throw new QuestionVerificationConflictError(`Source question ${reference.sourceContainer}:${reference.questionId} was updated concurrently; verification was not overwritten.`);
    }
    try {
      await this.database.container(reference.sourceContainer).item(reference.questionId, reference.questionId)
        .patch([{ op: "set", path: "/verification", value: data }], {
          accessCondition: { type: "IfMatch", condition: current.etag },
        });
    } catch (error) {
      if (statusCode(error) === 412) {
        throw new QuestionVerificationConflictError(`Source question ${reference.sourceContainer}:${reference.questionId} changed during its verification update.`, { cause: error });
      }
      throw error;
    }
    const saved = await this.readQuestionSnapshot(reference);
    if (hashContent(saved.question) !== data.sourceContentHash ||
        JSON.stringify(saved.verification) !== JSON.stringify(data)) {
      throw new QuestionVerificationConflictError(`Verification for ${reference.sourceContainer}:${reference.questionId} could not be confirmed after saving.`);
    }
    return saved;
  }

  async saveQuestionClassification(
    reference: QuestionReference, labels: { subject: string; topic: string },
    verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot> {
    const data = questionVerificationSchema.parse(verification);
    const current = await this.readQuestionSnapshot(reference);
    if (current.etag !== expected.etag || hashContent(current.question) !== hashContent(expected.question) ||
        data.sourceContentHash !== hashContent({ ...expected.question, subject: labels.subject, topic: labels.topic })) {
      throw new QuestionVerificationConflictError("Source changed before its classification could be saved.");
    }
    try {
      await this.database.container(reference.sourceContainer).item(reference.questionId, reference.questionId).patch([
        { op: "set", path: "/subject", value: labels.subject },
        { op: "set", path: "/topic", value: labels.topic },
        { op: "set", path: "/verification", value: data },
      ], { accessCondition: { type: "IfMatch", condition: current.etag } });
    } catch (error) {
      if (statusCode(error) === 412) {
        throw new QuestionVerificationConflictError("Source changed during its classification update.", { cause: error });
      }
      throw error;
    }
    const saved = await this.readQuestionSnapshot(reference);
    if (hashContent(saved.question) !== data.sourceContentHash ||
        hashContent(saved.verification) !== hashContent(data)) {
      throw new QuestionVerificationConflictError("Classification source write could not be confirmed.");
    }
    return saved;
  }

  async readProfile(id: string): Promise<ProfileSnapshot | undefined> {
    try {
      const { resource } = await this.database.container(profileContainerId).item(id, id).read<unknown>();
      if (!resource) return undefined;
      return {
        document: storedProfileSchema.parse(resource),
        etag: etagSchema.parse(resource)._etag,
      };
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }

  async saveSubtopicProfile(document: StoredProfile, etag: string): Promise<ProfileSnapshot> {
    const data = storedProfileSchema.parse(document);
    if (!etag || data.id !== `${data.sourceContainer}:${data.questionId}` ||
        !data.classification?.master || !data.processing.subtopicMaintenance) {
      throw new Error("Subtopic patch requires a reviewed existing profile, audit and ETag.");
    }
    const before = await this.readProfile(data.id);
    if (!before || before.etag !== etag) throw new Error("Profile changed before its subtopic patch.");
    const protectedContent = (value: StoredProfile) => {
      const result = structuredClone(value);
      if (result.classification) {
        delete result.classification.subtopics;
        if (result.classification.master) delete result.classification.master.subtopicIds;
      }
      delete result.processing.subtopicMaintenance;
      return result;
    };
    if (hashContent(protectedContent(before.document)) !== hashContent(protectedContent(data))) {
      throw new Error("Subtopic patch cannot alter protected profile fields.");
    }
    await this.database.container(profileContainerId).item(data.id, data.id).patch([
      { op: "set", path: "/classification/subtopics", value: data.classification.subtopics },
      { op: "set", path: "/classification/master/subtopicIds", value: data.classification.master.subtopicIds },
      { op: "set", path: "/processing/subtopicMaintenance", value: data.processing.subtopicMaintenance },
    ], { accessCondition: { type: "IfMatch", condition: etag } });
    const confirmed = await this.readProfile(data.id);
    if (!confirmed || hashContent(confirmed.document) !== hashContent(data)) {
      throw new Error("Subtopic profile patch could not be confirmed.");
    }
    return confirmed;
  }

  async readMasterClassification(subjectId: string, topicId: string, subtopicIds: readonly string[] = []) {
    const container = this.database.container(masterContainerId);
    try {
      const [subjectRead, topicRead] = await Promise.all([
        container.item(subjectId, subjectId).read<unknown>(),
        container.item(topicId, subjectId).read<unknown>(),
      ]);
      if (!subjectRead.resource || !topicRead.resource) return undefined;
      const subject = masterRecordSchema.parse(subjectRead.resource);
      const topic = masterRecordSchema.parse(topicRead.resource);
      if (subject.type !== "subject" || topic.type !== "topic" || !subject.isActive || !topic.isActive ||
          subject.id !== subjectId || topic.id !== topicId || topic.parentId !== subjectId) return undefined;
      const subtopics = await Promise.all(subtopicIds.map(async id => {
        const { resource } = await container.item(id, subjectId).read<unknown>();
        if (!resource) return undefined;
        const record = masterRecordSchema.parse(resource);
        return record.type === "subtopic" && record.isActive && record.id === id &&
          record.parentId === topicId && record.subjectId === subjectId ? { id, name: record.name } : undefined;
      }));
      if (subtopics.some(record => !record)) return undefined;
      return { subject: subject.name, topic: topic.name, subtopics };
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }

  async saveProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot> {
    const data = storedProfileSchema.parse(document);
    if (data.id !== `${data.sourceContainer}:${data.questionId}`) throw new Error("Invalid profile identity.");
    const container = this.database.container(profileContainerId);
    const response = etag
      ? await container.item(data.id, data.id).replace(data, {
          accessCondition: { type: "IfMatch", condition: etag },
        })
      : await container.items.create(data);
    if (!response.resource) throw new Error(`Cosmos did not return the saved profile ${data.id}.`);
    return {
      document: storedProfileSchema.parse(response.resource),
      etag: etagSchema.parse(response.resource)._etag,
    };
  }

  async readProvisionalProfile(id: string): Promise<ProfileSnapshot | undefined> {
    try {
      const { resource } = await this.database.container(provisionalProfileContainerId).item(id, id).read<unknown>();
      return resource ? { document: storedProfileSchema.parse(resource), etag: etagSchema.parse(resource)._etag } : undefined;
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }

  async saveProvisionalProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot> {
    const data = storedProfileSchema.parse(document);
    if (data.id !== `${data.sourceContainer}:${data.questionId}` || !data.processing.provisionalEmbedding)
      throw new Error("Provisional storage requires explicit profile-bound authorization.");
    const container = this.database.container(provisionalProfileContainerId);
    const response = etag
      ? await container.item(data.id, data.id).replace(data, { accessCondition: { type: "IfMatch", condition: etag } })
      : await container.items.create(data);
    if (!response.resource) throw new Error(`Provisional profile ${data.id} save was not confirmed.`);
    return { document: storedProfileSchema.parse(response.resource), etag: etagSchema.parse(response.resource)._etag };
  }

  async listConcepts(): Promise<CanonicalConcept[]> {
    const { resources } = await this.database.container(conceptsContainerId).items
      .query<unknown>({
        query: "SELECT * FROM c WHERE c.id != @lock",
        parameters: [{ name: "@lock", value: conceptRegistryLockId }],
      }).fetchAll();
    return resources.map(resource => canonicalConceptSchema.parse(resource));
  }

  async releaseConceptRegistryLock(owner: string): Promise<void> {
    const item = this.database.container(conceptsContainerId).item(conceptRegistryLockId, conceptRegistryLockId);
    const { resource } = await item.read<unknown>();
    const lock = registryLockSchema.parse(resource);
    if (lock.owner !== owner) throw new Error("Concept registry owner changed; its lock was not released.");
    await item.delete({ accessCondition: { type: "IfMatch", condition: etagSchema.parse(resource)._etag } });
  }

  async withConceptRegistry<T>(action: (session: ClassificationRegistrySession) => Promise<T>): Promise<T> {
    const container = this.database.container(conceptsContainerId);
    const item = container.item(conceptRegistryLockId, conceptRegistryLockId);
    const lock: z.infer<typeof registryLockSchema> = {
      id: conceptRegistryLockId, owner: randomUUID(), acquiredAt: new Date().toISOString(), proposals: [],
    };
    const deadline = Date.now() + this.coordinationTimeoutMs;
    let etag: string;
    while (true) {
      try {
        const { resource } = await container.items.create(lock);
        etag = etagSchema.parse(resource)._etag;
        break;
      } catch (error) {
        if (statusCode(error) !== 409) {
          throw new Error(`Concept registry lock acquisition could not be confirmed (owner ${lock.owner}). Check for a retained lock before retrying.`, { cause: error });
        }
        if (Date.now() >= deadline) {
          const { resource } = await item.read<unknown>();
          const active = registryLockSchema.parse(resource);
          throw new Error(`Concept registry coordinator is busy (owner ${active.owner}). Retry later. A crashed writer's lock requires explicit recovery; it never expires automatically.`);
        }
        await setTimeout(250);
      }
    }
    let uncertainWrite = false;
    let failure: unknown;
    try {
      const concepts = await this.listConcepts();
      return await action({
        concepts,
        createConcept: async concept => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; further creation is blocked.`);
          const data = canonicalConceptSchema.parse(concept);
          lock.proposals = [data];
          lock.classificationUpdates = [];
          const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
          etag = etagSchema.parse(resource)._etag;
          try {
            return await this.createConcept(data);
          } catch (error) {
            // An unconfirmed write may still complete remotely. Do not admit another writer.
            uncertainWrite = true;
            throw new Error(`Canonical write outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
        reclassifyConcept: async update => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; further updates are blocked.`);
          const approved = classificationUpdateSchema.parse(update);
          const master = await this.readMasterClassification(approved.subjectId, approved.topicId);
          if (!master) throw new Error("Canonical reclassification requires an active master subject/topic pair.");
          const conceptItem = container.item(approved.expected.id, approved.expected.id);
          const { resource: before } = await conceptItem.read<unknown>();
          const current = canonicalConceptSchema.parse(before);
          if (hashContent(current) !== hashContent(approved.expected) || current.status === "retired") {
            throw new Error(`Canonical concept ${current.id} changed after review; no classification was overwritten.`);
          }
          const profiles = this.database.container(profileContainerId);
          const { resources: dependencies } = await profiles.items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE
              (ARRAY_CONTAINS(c.concept_profile.primary_concepts, @assignment, true) OR
               ARRAY_CONTAINS(c.concept_profile.secondary_concepts, @assignment, true))
              AND NOT ARRAY_CONTAINS(@allowed, c.id)`,
            parameters: [
              { name: "@assignment", value: { concept_id: current.id } },
              { name: "@allowed", value: approved.allowedProfileIds },
            ],
          }).fetchAll();
          if (dependencies.length) {
            throw new Error(`Canonical concept ${current.id} is shared outside the approved scope: ${dependencies.join(", ")}.`);
          }
          const { resources: active } = await profiles.items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE c.processing.status IN ("extracting", "embedding")
              AND c.processing.updatedAt >= @leaseStart`,
            parameters: [{ name: "@leaseStart", value: new Date(Date.now() - 15 * 60_000).toISOString() }],
          }).fetchAll();
          if (active.length) throw new Error(`Active pipeline leases must finish before canonical reclassification: ${active.join(", ")}.`);
          const proposed = { ...current, subject: master.subject, topic: master.topic };
          if (hashContent(proposed) === hashContent(current)) return current;
          lock.proposals = [proposed];
          lock.classificationUpdates = [{ ...approved, proposed }];
          const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
          etag = etagSchema.parse(resource)._etag;
          try {
            await conceptItem.patch([
              { op: "set", path: "/subject", value: proposed.subject },
              { op: "set", path: "/topic", value: proposed.topic },
            ], { accessCondition: { type: "IfMatch", condition: etagSchema.parse(before)._etag } });
            const confirmed = canonicalConceptSchema.parse((await conceptItem.read<unknown>()).resource);
            if (hashContent(confirmed) !== hashContent(proposed)) {
              throw new Error(`Canonical classification ${current.id} could not be confirmed after saving.`);
            }
            const index = concepts.findIndex(concept => concept.id === current.id);
            if (index >= 0) concepts[index] = confirmed;
            return confirmed;
          } catch (error) {
            uncertainWrite = true;
            throw new Error(`Canonical classification outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
        reclassifyIsolatedConcept: async update => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; further updates are blocked.`);
          const approved = isolatedClassificationUpdateSchema.parse(update);
          if (registryFingerprint(concepts) !== approved.expectedRegistryFingerprint) {
            throw new Error("Canonical registry changed after isolated classification review.");
          }
          const master = await this.readMasterClassification(approved.subjectId, approved.topicId);
          if (!master || master.subject !== approved.subject || master.topic !== approved.topic) {
            throw new Error("Isolated classification requires the exact reviewed active master pair.");
          }
          const conceptItem = container.item(approved.expected.id, approved.expected.id);
          const { resource: before } = await conceptItem.read<unknown>();
          const current = canonicalConceptSchema.parse(before);
          if (hashContent(current) !== hashContent(approved.expected) || current.status === "retired" ||
              etagSchema.parse(before)._etag !== approved.expectedConceptEtag) {
            throw new Error(`Canonical concept ${current.id} changed after review; no classification was overwritten.`);
          }
          if (!current.definition.includes(approved.definitionEvidence)) {
            throw new Error("Isolated classification requires literal evidence from the unchanged definition.");
          }
          const { resources: parents } = await container.items.query<string>({
            query: "SELECT VALUE c.id FROM c WHERE ARRAY_CONTAINS(c.parentConceptIds, @conceptId)",
            parameters: [{ name: "@conceptId", value: current.id }],
          }).fetchAll();
          if (parents.length) throw new Error(`Canonical parent dependencies still reference ${current.id}: ${parents.join(", ")}.`);
          const profiles = this.database.container(profileContainerId);
          const { resources: dependencies } = await profiles.items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE
              ARRAY_CONTAINS(c.concept_profile.primary_concepts, @assignment, true)
              OR ARRAY_CONTAINS(c.concept_profile.secondary_concepts, @assignment, true)
              OR EXISTS (SELECT VALUE x FROM x IN c.claims WHERE ARRAY_CONTAINS(x.concept_ids, @conceptId))
              OR ARRAY_CONTAINS(c.highlight_evidence, @assignment, true)
              OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.coverage.items WHERE
                ARRAY_CONTAINS(x.concept_ids, @conceptId) OR ARRAY_CONTAINS(x.source_evidence, @assignment, true))
              OR ARRAY_CONTAINS(c.concept_review.decisions, @assignment, true)
              OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.decisions WHERE
                x.existing_concept_id = @conceptId OR ARRAY_CONTAINS(x.source_evidence, @assignment, true))
              OR ARRAY_CONTAINS(c.concept_review.highlights.gaps, @assignment, true)
              OR ARRAY_CONTAINS(c.concept_review.highlights.extended_excerpts, @assignment, true)
              OR c.classification.review.primary_concept_id = @conceptId
              OR ARRAY_CONTAINS(c.classification.review.source_evidence, @assignment, true)`,
            parameters: [
              { name: "@assignment", value: { concept_id: current.id } },
              { name: "@conceptId", value: current.id },
            ],
          }).fetchAll();
          if (dependencies.length) throw new Error(`Isolated concept ${current.id} has profile references: ${dependencies.join(", ")}.`);
          const { resources: active } = await profiles.items.query<string>({
            query: 'SELECT VALUE c.id FROM c WHERE c.processing.status IN ("extracting", "embedding")',
          }).fetchAll();
          if (active.length) throw new Error(`Active pipeline leases must finish before isolated classification: ${active.join(", ")}.`);
          const currentMaster = await this.readMasterClassification(approved.subjectId, approved.topicId);
          if (hashContent(currentMaster ?? null) !== hashContent(master)) {
            throw new Error("Active master changed during isolated classification; nothing was saved.");
          }
          const proposed = { ...current, subject: master.subject, topic: master.topic };
          if (hashContent(proposed) === hashContent(current)) return current;
          lock.proposals = [proposed];
          lock.isolatedClassificationUpdates = [{ ...approved, proposed }];
          const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
          etag = etagSchema.parse(resource)._etag;
          try {
            await conceptItem.patch([
              { op: "set", path: "/subject", value: proposed.subject },
              { op: "set", path: "/topic", value: proposed.topic },
            ], { accessCondition: { type: "IfMatch", condition: etagSchema.parse(before)._etag } });
            const confirmed = canonicalConceptSchema.parse((await conceptItem.read<unknown>()).resource);
            const confirmedMaster = await this.readMasterClassification(approved.subjectId, approved.topicId);
            if (hashContent(confirmed) !== hashContent(proposed) ||
                hashContent(confirmedMaster ?? null) !== hashContent(master)) {
              throw new Error("Isolated classification read-back or its master binding differs from the reviewed proposal.");
            }
            const index = concepts.findIndex(concept => concept.id === current.id);
            if (index >= 0) concepts[index] = confirmed;
            return confirmed;
          } catch (error) {
            uncertainWrite = true;
            throw new Error(`Isolated classification outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
        reclassifyCoordinatedConcept: async update => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; further updates are blocked.`);
          const approved = coordinatedClassificationUpdateSchema.parse(update);
          const dependencyIds = approved.dependencies.map(dependency => dependency.profileId);
          const parentIds = approved.parentDependencies.map(dependency => dependency.expected.id);
          if ((!dependencyIds.length && !parentIds.length) ||
              new Set(dependencyIds).size !== dependencyIds.length || new Set(parentIds).size !== parentIds.length) {
            throw new Error("Coordinated classification requires unique reviewed dependencies; use the isolated route when there are none.");
          }
          if (registryFingerprint(concepts) !== approved.expectedRegistryFingerprint) {
            throw new Error("Canonical registry changed after coordinated classification review.");
          }
          const current = approved.expected;
          if (current.status === "retired" || !current.definition.includes(approved.definitionEvidence)) {
            throw new Error("Coordinated classification requires a non-retired concept and literal definition evidence.");
          }
          const proposed = { ...current, subject: approved.subject, topic: approved.topic };
          const conceptItem = container.item(current.id, current.id);
          const profiles = this.database.container(profileContainerId);
          const references = approved.dependencies.map(dependency => {
            const separator = dependency.profileId.indexOf(":");
            const sourceContainer = z.enum(sourceContainers).parse(dependency.profileId.slice(0, separator));
            const questionId = dependency.profileId.slice(separator + 1);
            if (separator < 1 || !questionId || dependency.profileId !== `${sourceContainer}:${questionId}`) {
              throw new Error("Coordinated dependency requires an exact sourceContainer:questionId profile identity.");
            }
            return { sourceContainer, questionId };
          });
          const readMasterBinding = async () => {
            const master = this.database.container(masterContainerId);
            const [subjectRead, topicRead] = await Promise.all([
              master.item(approved.subjectId, approved.subjectId).read<unknown>(),
              master.item(approved.topicId, approved.subjectId).read<unknown>(),
            ]);
            const subject = masterRecordSchema.parse(subjectRead.resource);
            const topic = masterRecordSchema.parse(topicRead.resource);
            if (subject.id !== approved.subjectId || subject.type !== "subject" || !subject.isActive ||
                subject.name !== approved.subject || topic.id !== approved.topicId || topic.type !== "topic" ||
                !topic.isActive || topic.parentId !== subject.id || topic.name !== approved.topic) {
              throw new Error("Coordinated classification requires the exact reviewed active master names and parent.");
            }
            etagSchema.parse(subjectRead.resource);
            etagSchema.parse(topicRead.resource);
            return hashContent([subjectRead.resource, topicRead.resource]);
          };
          const masterBinding = await readMasterBinding();
          const sameSet = (actual: string[], expected: string[]) =>
            actual.length === expected.length && new Set(actual).size === actual.length &&
            actual.every(id => expected.includes(id));
          const assertBindings = async (written: boolean, writtenEtag?: string) => {
            const { resource: canonical } = await conceptItem.read<unknown>();
            if (hashContent(canonicalConceptSchema.parse(canonical)) !== hashContent(written ? proposed : current) ||
                etagSchema.parse(canonical)._etag !== (written ? writtenEtag : approved.expectedConceptEtag)) {
              throw new Error("Canonical record or ETag changed after coordinated classification review.");
            }
            const liveRegistry = await this.listConcepts();
            const expectedRegistry = concepts.map(concept => written && concept.id === current.id ? proposed : concept);
            if (registryFingerprint(liveRegistry) !== registryFingerprint(expectedRegistry)) {
              throw new Error("Canonical registry changed during coordinated classification.");
            }
            const { resources: parents } = await container.items.query<string>({
              query: "SELECT VALUE c.id FROM c WHERE ARRAY_CONTAINS(c.parentConceptIds, @conceptId)",
              parameters: [{ name: "@conceptId", value: current.id }],
            }).fetchAll();
            if (!sameSet(parents, parentIds)) throw new Error("Canonical parent dependency set changed or lacks review.");
            for (const dependency of approved.parentDependencies) {
              const { resource } = await container.item(dependency.expected.id, dependency.expected.id).read<unknown>();
              if (dependency.expected.id === current.id ||
                  !dependency.expected.parentConceptIds.includes(current.id) ||
                  hashContent(canonicalConceptSchema.parse(resource)) !== hashContent(dependency.expected) ||
                  etagSchema.parse(resource)._etag !== dependency.expectedConceptEtag) {
                throw new Error("Canonical parent dependency record or ETag changed after review.");
              }
            }
            const { resources: dependencies } = await profiles.items.query<string>({
              query: `SELECT VALUE c.id FROM c WHERE
                ARRAY_CONTAINS(c.concept_profile.primary_concepts, @assignment, true)
                OR ARRAY_CONTAINS(c.concept_profile.secondary_concepts, @assignment, true)
                OR EXISTS (SELECT VALUE x FROM x IN c.claims WHERE ARRAY_CONTAINS(x.concept_ids, @conceptId))
                OR ARRAY_CONTAINS(c.highlight_evidence, @assignment, true)
                OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.coverage.items WHERE
                  ARRAY_CONTAINS(x.concept_ids, @conceptId) OR ARRAY_CONTAINS(x.source_evidence, @assignment, true))
                OR ARRAY_CONTAINS(c.concept_review.decisions, @assignment, true)
                OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.decisions WHERE
                  x.existing_concept_id = @conceptId OR ARRAY_CONTAINS(x.source_evidence, @assignment, true))
                OR ARRAY_CONTAINS(c.concept_review.highlights.gaps, @assignment, true)
                OR ARRAY_CONTAINS(c.concept_review.highlights.extended_excerpts, @assignment, true)
                OR c.classification.review.primary_concept_id = @conceptId
                OR ARRAY_CONTAINS(c.classification.review.source_evidence, @assignment, true)`,
              parameters: [
                { name: "@assignment", value: { concept_id: current.id } },
                { name: "@conceptId", value: current.id },
              ],
            }).fetchAll();
            if (!sameSet(dependencies, dependencyIds)) {
              throw new Error("Meaningful profile dependency set changed or lacks coordinated review.");
            }
            for (const [index, dependency] of approved.dependencies.entries()) {
              const reference = references[index];
              const profile = await this.readProfile(dependency.profileId);
              const source = await this.readQuestionSnapshot(reference);
              if (!profile || profile.etag !== dependency.profileEtag ||
                  hashContent(profile.document) !== dependency.profileHash ||
                  profile.document.id !== dependency.profileId ||
                  profile.document.sourceContainer !== reference.sourceContainer ||
                  profile.document.questionId !== reference.questionId ||
                  profile.document.processing.sourceContentHash !== dependency.sourceContentHash ||
                  source.etag !== dependency.sourceEtag ||
                  hashContent(source.question) !== dependency.sourceContentHash ||
                  (source.verification && source.verification.sourceContentHash !== dependency.sourceContentHash) ||
                  hashContent(source) !== dependency.sourceSnapshotHash) {
                throw new Error(`Coordinated source/profile binding changed for ${dependency.profileId}.`);
              }
              for (const evidence of dependency.sourceEvidence) {
                const text = evidence.field === "option" ? source.question.options[evidence.option_index!]
                  : source.question[evidence.field];
                if (typeof text !== "string" || !text.includes(evidence.exact_text)) {
                  throw new Error(`Coordinated source evidence is not literal for ${dependency.profileId}.`);
                }
              }
              const document = profile.document;
              const assigned = [...(document.concept_profile?.primary_concepts ?? []),
                ...(document.concept_profile?.secondary_concepts ?? [])];
              const anchorId = document.classification?.review?.primary_concept_id ??
                document.concept_profile?.primary_concepts[0]?.concept_id;
              if (document.classification && assigned.some(assignment => assignment.concept_id === current.id) &&
                  anchorId === current.id && classificationTaxonomyIssue(document.classification, proposed) &&
                  !classificationTaxonomyIssue(document.classification, current)) {
                throw new Error(`Coordinated metadata would introduce a primary-anchor classification conflict for ${dependency.profileId}.`);
              }
            }
            const { resources: active } = await profiles.items.query<string>({
              query: 'SELECT VALUE c.id FROM c WHERE c.processing.status IN ("extracting", "embedding")',
            }).fetchAll();
            if (active.length) throw new Error(`Active pipeline leases must finish before coordinated classification: ${active.join(", ")}.`);
            if (await readMasterBinding() !== masterBinding) {
              throw new Error("Active master changed during coordinated classification.");
            }
            const { resource: owned } = await item.read<unknown>();
            if (registryLockSchema.parse(owned).owner !== lock.owner || etagSchema.parse(owned)._etag !== etag) {
              uncertainWrite = true;
              throw new Error("Coordinated classification coordinator ownership changed.");
            }
          };
          await assertBindings(false);
          if (hashContent(proposed) === hashContent(current)) return current;
          lock.proposals = [proposed];
          lock.coordinatedClassificationUpdates = [...(lock.coordinatedClassificationUpdates ?? []), { ...approved, proposed }];
          const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
          etag = etagSchema.parse(resource)._etag;
          await assertBindings(false);
          try {
            const { resource: patched } = await conceptItem.patch([
              { op: "set", path: "/subject", value: proposed.subject },
              { op: "set", path: "/topic", value: proposed.topic },
            ], { accessCondition: { type: "IfMatch", condition: approved.expectedConceptEtag } });
            await assertBindings(true, etagSchema.parse(patched)._etag);
            const index = concepts.findIndex(concept => concept.id === current.id);
            if (index >= 0) concepts[index] = proposed;
            return proposed;
          } catch (error) {
            uncertainWrite = true;
            throw new Error(`Coordinated classification outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
        reclassifyCoordinatedBatch: async updates => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; further updates are blocked.`);
          const approved = z.array(coordinatedClassificationUpdateSchema).min(1).max(20).parse(updates);
          const ids = approved.map(update => update.expected.id);
          const startFingerprint = registryFingerprint(concepts);
          if (new Set(ids).size !== ids.length ||
              approved.some(update => update.expectedRegistryFingerprint !== startFingerprint)) {
            throw new Error("Coordinated batch requires distinct IDs and the same current batch-start registry fingerprint.");
          }
          const staged = approved.map(update => {
            const profileIds = update.dependencies.map(dependency => dependency.profileId);
            const parentIds = update.parentDependencies.map(dependency => dependency.expected.id);
            if ((!profileIds.length && !parentIds.length) || new Set(profileIds).size !== profileIds.length ||
                new Set(parentIds).size !== parentIds.length || update.expected.status === "retired" ||
                !update.expected.definition.includes(update.definitionEvidence)) {
              throw new Error("Coordinated batch requires unique reviewed dependencies, non-retired records and literal definition evidence.");
            }
            return { ...update, proposed: { ...update.expected, subject: update.subject, topic: update.topic } };
          });
          const byId = new Map(staged.map(update => [update.expected.id, update]));
          const profiles = this.database.container(profileContainerId);
          const master = this.database.container(masterContainerId);
          const masterRequests = new Map<string, { id: string; partition: string }>();
          const references = new Map<string, QuestionReference>();
          for (const update of staged) {
            for (const id of [update.subjectId, update.topicId]) {
              masterRequests.set(`${update.subjectId}:${id}`, { id, partition: update.subjectId });
            }
            for (const dependency of update.dependencies) {
              const separator = dependency.profileId.indexOf(":");
              const sourceContainer = z.enum(sourceContainers).parse(dependency.profileId.slice(0, separator));
              const questionId = dependency.profileId.slice(separator + 1);
              if (separator < 1 || !questionId || dependency.profileId !== `${sourceContainer}:${questionId}`) {
                throw new Error("Coordinated batch dependency requires an exact sourceContainer:questionId identity.");
              }
              references.set(dependency.profileId, { sourceContainer, questionId });
            }
          }
          const mapFour = async <T, R>(values: T[], read: (value: T) => Promise<R>): Promise<R[]> => {
            const result: R[] = [];
            for (let offset = 0; offset < values.length; offset += 4) {
              const settled = await Promise.allSettled(values.slice(offset, offset + 4).map(read));
              const failed = settled.filter(value => value.status === "rejected");
              if (failed.length) throw new AggregateError(failed.map(value => value.reason), "Coordinated batch reads failed.");
              result.push(...settled.map(value => (value as PromiseFulfilledResult<R>).value));
            }
            return result;
          };
          const sameSet = (actual: string[], expected: string[]) =>
            actual.length === expected.length && new Set(actual).size === actual.length &&
            actual.every(id => expected.includes(id));
          const meaningfulReferences = (document: StoredProfile) => {
            const result = new Set<string>();
            const evidence = (values: { concept_id: string }[] | undefined) =>
              values?.forEach(value => result.add(value.concept_id));
            evidence(document.concept_profile?.primary_concepts);
            evidence(document.concept_profile?.secondary_concepts);
            document.claims?.forEach(claim => claim.concept_ids.forEach(id => result.add(id)));
            evidence(document.highlight_evidence);
            document.concept_review?.coverage?.items.forEach(item => {
              item.concept_ids.forEach(id => result.add(id));
              evidence(item.source_evidence);
            });
            document.concept_review?.decisions.forEach(decision => {
              result.add(decision.concept_id);
              if (decision.existing_concept_id) result.add(decision.existing_concept_id);
              evidence(decision.source_evidence);
            });
            evidence(document.concept_review?.highlights?.gaps);
            evidence(document.concept_review?.highlights?.extended_excerpts);
            if (document.classification?.review) {
              result.add(document.classification.review.primary_concept_id);
              evidence(document.classification.review.source_evidence);
            }
            return result;
          };
          let masterBindings: Map<string, string> | undefined;
          const writtenEtags = new Map(staged.map(update => [update.expected.id, update.expectedConceptEtag]));
          const assertBatchBindings = async (written: boolean) => {
            const [registryRead, profileRead, parentRead, activeRead, masterReads, sourceReads] = await Promise.all([
              container.items.query<unknown>({
                query: "SELECT * FROM c WHERE c.id != @lock",
                parameters: [{ name: "@lock", value: conceptRegistryLockId }],
              }).fetchAll(),
              profiles.items.query<unknown>({
                query: `SELECT * FROM c WHERE
                  EXISTS (SELECT VALUE x FROM x IN c.concept_profile.primary_concepts WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))
                  OR EXISTS (SELECT VALUE x FROM x IN c.concept_profile.secondary_concepts WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))
                  OR EXISTS (SELECT VALUE x FROM x IN c.claims WHERE
                    EXISTS (SELECT VALUE id FROM id IN x.concept_ids WHERE ARRAY_CONTAINS(@conceptIds, id)))
                  OR EXISTS (SELECT VALUE x FROM x IN c.highlight_evidence WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))
                  OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.coverage.items WHERE
                    EXISTS (SELECT VALUE id FROM id IN x.concept_ids WHERE ARRAY_CONTAINS(@conceptIds, id))
                    OR EXISTS (SELECT VALUE e FROM e IN x.source_evidence WHERE ARRAY_CONTAINS(@conceptIds, e.concept_id)))
                  OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.decisions WHERE
                    ARRAY_CONTAINS(@conceptIds, x.concept_id) OR ARRAY_CONTAINS(@conceptIds, x.existing_concept_id)
                    OR EXISTS (SELECT VALUE e FROM e IN x.source_evidence WHERE ARRAY_CONTAINS(@conceptIds, e.concept_id)))
                  OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.highlights.gaps WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))
                  OR EXISTS (SELECT VALUE x FROM x IN c.concept_review.highlights.extended_excerpts WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))
                  OR ARRAY_CONTAINS(@conceptIds, c.classification.review.primary_concept_id)
                  OR EXISTS (SELECT VALUE x FROM x IN c.classification.review.source_evidence WHERE ARRAY_CONTAINS(@conceptIds, x.concept_id))`,
                parameters: [{ name: "@conceptIds", value: ids }],
              }).fetchAll(),
              container.items.query<unknown>({
                query: `SELECT c.id, c.parentConceptIds FROM c WHERE
                  EXISTS (SELECT VALUE id FROM id IN c.parentConceptIds WHERE ARRAY_CONTAINS(@conceptIds, id))`,
                parameters: [{ name: "@conceptIds", value: ids }],
              }).fetchAll(),
              profiles.items.query<string>({
                query: 'SELECT VALUE c.id FROM c WHERE c.processing.status IN ("extracting", "embedding")',
              }).fetchAll(),
              mapFour([...masterRequests], async ([key, request]) => {
                const { resource } = await master.item(request.id, request.partition).read<unknown>();
                return { key, resource, document: masterRecordSchema.parse(resource), etag: etagSchema.parse(resource)._etag };
              }),
              mapFour([...references], async ([id, reference]) =>
                [id, await this.readQuestionSnapshot(reference)] as const),
            ]);
            const registry = new Map(registryRead.resources.map(resource => {
              const document = canonicalConceptSchema.parse(resource);
              return [document.id, { document, etag: etagSchema.parse(resource)._etag }] as const;
            }));
            const expectedRegistry = concepts.map(document => written ? byId.get(document.id)?.proposed ?? document : document);
            if (registry.size !== registryRead.resources.length ||
                registryFingerprint([...registry.values()].map(value => value.document)) !== registryFingerprint(expectedRegistry)) {
              throw new Error("Canonical registry changed during coordinated batch classification.");
            }
            if (activeRead.resources.length) throw new Error("Active pipeline leases must finish before coordinated batch classification.");
            const parents = parentRead.resources.map(resource =>
              z.object({ id: z.string(), parentConceptIds: z.array(z.string()) }).parse(resource));
            const actualProfiles = new Map(profileRead.resources.map(resource => {
              const document = storedProfileSchema.parse(resource);
              return [document.id, { document, etag: etagSchema.parse(resource)._etag, references: meaningfulReferences(document) }] as const;
            }));
            if (actualProfiles.size !== profileRead.resources.length) throw new Error("Duplicate batch profile inventory.");
            const sources = new Map(sourceReads);
            const masters = new Map(masterReads.map(value => [value.key, value]));
            for (const update of staged) {
              const canonical = registry.get(update.expected.id);
              if (!canonical || hashContent(canonical.document) !== hashContent(written ? update.proposed : update.expected) ||
                  canonical.etag !== writtenEtags.get(update.expected.id)) {
                throw new Error("Canonical batch record or ETag changed after review.");
              }
              const actualParents = parents.filter(parent => parent.parentConceptIds.includes(update.expected.id)).map(parent => parent.id);
              const registryParents = [...registry.values()].filter(parent =>
                parent.document.parentConceptIds.includes(update.expected.id)).map(parent => parent.document.id);
              if (!sameSet(actualParents, update.parentDependencies.map(parent => parent.expected.id)) ||
                  !sameSet(actualParents, registryParents)) {
                throw new Error("Canonical batch parent dependency set changed or lacks review.");
              }
              for (const parent of update.parentDependencies) {
                const actual = registry.get(parent.expected.id);
                const parentUpdate = byId.get(parent.expected.id);
                if (parent.expected.id === update.expected.id || !parent.expected.parentConceptIds.includes(update.expected.id) ||
                    (parentUpdate && (hashContent(parentUpdate.expected) !== hashContent(parent.expected) ||
                      parentUpdate.expectedConceptEtag !== parent.expectedConceptEtag)) ||
                    !actual || hashContent(actual.document) !== hashContent(written && parentUpdate ? parentUpdate.proposed : parent.expected) ||
                    actual.etag !== (written && parentUpdate ? writtenEtags.get(parent.expected.id) : parent.expectedConceptEtag)) {
                  throw new Error("Canonical batch parent record or ETag changed after review.");
                }
              }
              const dependencyIds = [...actualProfiles].filter(([, value]) => value.references.has(update.expected.id)).map(([id]) => id);
              if (!sameSet(dependencyIds, update.dependencies.map(dependency => dependency.profileId))) {
                throw new Error("Meaningful batch profile dependency set changed or lacks review.");
              }
              for (const dependency of update.dependencies) {
                const profile = actualProfiles.get(dependency.profileId);
                const source = sources.get(dependency.profileId);
                const reference = references.get(dependency.profileId)!;
                if (!profile || !source || profile.etag !== dependency.profileEtag ||
                    hashContent(profile.document) !== dependency.profileHash ||
                    profile.document.sourceContainer !== reference.sourceContainer ||
                    profile.document.questionId !== reference.questionId ||
                    profile.document.id !== `${reference.sourceContainer}:${reference.questionId}` ||
                    profile.document.processing.sourceContentHash !== dependency.sourceContentHash ||
                    source.etag !== dependency.sourceEtag || hashContent(source.question) !== dependency.sourceContentHash ||
                    (source.verification && source.verification.sourceContentHash !== dependency.sourceContentHash) ||
                    hashContent(source) !== dependency.sourceSnapshotHash) {
                  throw new Error(`Coordinated batch source/profile binding changed for ${dependency.profileId}.`);
                }
                for (const evidence of dependency.sourceEvidence) {
                  const text = evidence.field === "option" ? source.question.options[evidence.option_index!]
                    : source.question[evidence.field];
                  if (typeof text !== "string" || !text.includes(evidence.exact_text)) {
                    throw new Error(`Coordinated batch source evidence is not literal for ${dependency.profileId}.`);
                  }
                }
                const document = profile.document;
                const assigned = [...(document.concept_profile?.primary_concepts ?? []), ...(document.concept_profile?.secondary_concepts ?? [])];
                const anchorId = document.classification?.review?.primary_concept_id ??
                  document.concept_profile?.primary_concepts[0]?.concept_id;
                if (document.classification && assigned.some(assignment => assignment.concept_id === update.expected.id) &&
                    anchorId === update.expected.id && classificationTaxonomyIssue(document.classification, update.proposed) &&
                    !classificationTaxonomyIssue(document.classification, update.expected)) {
                  throw new Error(`Coordinated batch metadata would introduce a primary-anchor classification conflict for ${dependency.profileId}.`);
                }
              }
              const subject = masters.get(`${update.subjectId}:${update.subjectId}`)!.document;
              const topic = masters.get(`${update.subjectId}:${update.topicId}`)!.document;
              if (subject.id !== update.subjectId || subject.type !== "subject" || !subject.isActive ||
                  subject.name !== update.subject || topic.id !== update.topicId || topic.type !== "topic" ||
                  !topic.isActive || topic.parentId !== subject.id || topic.name !== update.topic) {
                throw new Error("Coordinated batch requires exact reviewed active master names and parent.");
              }
            }
            const currentMasterBindings = new Map(masterReads.map(value => [value.key, hashContent(value.resource)]));
            if (masterBindings && [...masterBindings].some(([key, hash]) => currentMasterBindings.get(key) !== hash)) {
              throw new Error("Active master changed during coordinated batch classification.");
            }
            masterBindings = currentMasterBindings;
            const { resource: owned } = await item.read<unknown>();
            if (registryLockSchema.parse(owned).owner !== lock.owner || etagSchema.parse(owned)._etag !== etag) {
              uncertainWrite = true;
              throw new Error("Coordinated batch coordinator ownership changed.");
            }
          };
          await assertBatchBindings(false);
          const changed = staged.filter(update => hashContent(update.expected) !== hashContent(update.proposed));
          if (!changed.length) return staged.map(update => update.expected);
          const batchId = randomUUID();
          lock.proposals = staged.map(update => update.proposed);
          lock.coordinatedClassificationUpdates = [
            ...(lock.coordinatedClassificationUpdates ?? []), ...staged.map(update => ({ ...update, batchId })),
          ];
          try {
            const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
            etag = etagSchema.parse(resource)._etag;
            if (hashContent(registryLockSchema.parse(resource)) !== hashContent(registryLockSchema.parse(lock))) {
              throw new Error("Coordinated batch journal write could not be confirmed.");
            }
            const { resource: owned } = await item.read<unknown>();
            if (etagSchema.parse(owned)._etag !== etag ||
                hashContent(registryLockSchema.parse(owned)) !== hashContent(registryLockSchema.parse(lock))) {
              throw new Error("Coordinated batch journal ownership or complete payload changed before persistence.");
            }
          } catch (error) {
            uncertainWrite = true;
            throw new Error(`Coordinated batch journal outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
          // Once a worker can issue a patch, every failure requires owner-bound reconciliation.
          uncertainWrite = true;
          try {
            let next = 0;
            const failures: unknown[] = [];
            const worker = async () => {
              while (!failures.length && next < changed.length) {
                const update = changed[next++];
                try {
                  const { resource } = await container.item(update.expected.id, update.expected.id).patch([
                    { op: "set", path: "/subject", value: update.proposed.subject },
                    { op: "set", path: "/topic", value: update.proposed.topic },
                  ], { accessCondition: { type: "IfMatch", condition: update.expectedConceptEtag } });
                  if (hashContent(canonicalConceptSchema.parse(resource)) !== hashContent(update.proposed)) {
                    throw new Error("Coordinated batch patch response differs from its approved proposal.");
                  }
                  writtenEtags.set(update.expected.id, etagSchema.parse(resource)._etag);
                } catch (error) {
                  failures.push(error);
                }
              }
            };
            const workers = await Promise.allSettled(Array.from({ length: Math.min(4, changed.length) }, worker));
            for (const result of workers) if (result.status === "rejected") failures.push(result.reason);
            if (failures.length) throw new AggregateError(failures, "Coordinated batch patches were not all confirmed.");
            await assertBatchBindings(true);
            for (const update of staged) {
              const index = concepts.findIndex(concept => concept.id === update.expected.id);
              concepts[index] = update.proposed;
            }
            uncertainWrite = false;
            return staged.map(update => update.proposed);
          } catch (error) {
            throw new Error(`Coordinated batch outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
        consolidateConcept: async update => {
          if (uncertainWrite) throw new Error(`Concept registry owner ${lock.owner} has an unresolved write; consolidation is blocked.`);
          const approved = consolidationUpdateSchema.parse(update);
          if (approved.expected.id === approved.replacement.id ||
              approved.expected.status === "retired" || approved.replacement.status === "retired") {
            throw new Error("Consolidation requires distinct, non-retired source and replacement concepts.");
          }
          const conceptItem = container.item(approved.expected.id, approved.expected.id);
          const [{ resource: before }, { resource: replacement }] = await Promise.all([
            conceptItem.read<unknown>(),
            container.item(approved.replacement.id, approved.replacement.id).read<unknown>(),
          ]);
          const current = canonicalConceptSchema.parse(before);
          if (hashContent(current) !== hashContent(approved.expected) ||
              hashContent(canonicalConceptSchema.parse(replacement)) !== hashContent(approved.replacement)) {
            throw new Error("Canonical consolidation source or replacement changed after review.");
          }
          if (concepts.some(concept => concept.parentConceptIds.includes(current.id))) {
            throw new Error(`Canonical parent dependencies still reference ${current.id}; review them before consolidation.`);
          }
          const profiles = this.database.container(profileContainerId);
          const { resources: dependencies } = await profiles.items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE
              (ARRAY_CONTAINS(c.concept_profile.primary_concepts, @assignment, true) OR
               ARRAY_CONTAINS(c.concept_profile.secondary_concepts, @assignment, true))
              AND NOT ARRAY_CONTAINS(@allowed, c.id)`,
            parameters: [
              { name: "@assignment", value: { concept_id: current.id } },
              { name: "@allowed", value: approved.allowedProfileIds },
            ],
          }).fetchAll();
          if (dependencies.length) throw new Error(`Consolidation has unreviewed dependent profiles: ${dependencies.join(", ")}.`);
          const { resources: active } = await profiles.items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE c.processing.status IN ("extracting", "embedding")
              AND c.processing.updatedAt >= @leaseStart`,
            parameters: [{ name: "@leaseStart", value: new Date(Date.now() - 15 * 60_000).toISOString() }],
          }).fetchAll();
          if (active.length) throw new Error(`Active pipeline leases must finish before consolidation: ${active.join(", ")}.`);
          const proposed: CanonicalConcept = {
            ...current, status: "retired",
            retirement: {
              replacementConceptId: approved.replacement.id, retiredAt: approved.reviewedAt,
              reviewedBy: approved.reviewedBy, auditReference: approved.auditReference,
            },
          };
          lock.proposals = [proposed];
          lock.consolidationUpdates = [...(lock.consolidationUpdates ?? []), { ...approved, proposed }];
          const { resource } = await item.replace(lock, { accessCondition: { type: "IfMatch", condition: etag } });
          etag = etagSchema.parse(resource)._etag;
          try {
            await conceptItem.patch([
              { op: "set", path: "/status", value: proposed.status },
              { op: "set", path: "/retirement", value: proposed.retirement },
            ], { accessCondition: { type: "IfMatch", condition: etagSchema.parse(before)._etag } });
            const confirmed = canonicalConceptSchema.parse((await conceptItem.read<unknown>()).resource);
            if (hashContent(confirmed) !== hashContent(proposed)) throw new Error("Canonical retirement read-back differs from its reviewed proposal.");
            const index = concepts.findIndex(concept => concept.id === current.id);
            if (index >= 0) concepts[index] = confirmed;
            return confirmed;
          } catch (error) {
            uncertainWrite = true;
            throw new Error(`Canonical consolidation outcome is uncertain. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
          }
        },
      });
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      if (!uncertainWrite && lock.consolidationUpdates?.length) {
        try {
          if (failure) throw failure;
          const { resources: remaining } = await this.database.container(profileContainerId).items.query<string>({
            query: `SELECT VALUE c.id FROM c WHERE
              EXISTS (SELECT VALUE p FROM p IN c.concept_profile.primary_concepts WHERE ARRAY_CONTAINS(@retired, p.concept_id))
              OR EXISTS (SELECT VALUE s FROM s IN c.concept_profile.secondary_concepts WHERE ARRAY_CONTAINS(@retired, s.concept_id))`,
            parameters: [{ name: "@retired", value: lock.consolidationUpdates.map(update => update.expected.id) }],
          }).fetchAll();
          if (remaining.length) throw new Error(`Dependent profiles still reference retired IDs: ${remaining.join(", ")}.`);
        } catch (error) {
          uncertainWrite = true;
          throw new Error(`Canonical consolidation is incomplete. Registry lock ${lock.owner} was retained for explicit reconciliation.`, { cause: error });
        }
      }
      if (!uncertainWrite) {
        try {
          await item.delete({ accessCondition: { type: "IfMatch", condition: etag } });
        } catch (error) {
          throw failure
            ? new AggregateError([failure, error], `Concept registry lock ${lock.owner} could not be released.`)
            : new Error(`Concept registry lock ${lock.owner} could not be released.`, { cause: error });
        }
      }
    }
  }

  private async createConcept(concept: CanonicalConcept): Promise<CanonicalConcept> {
    const data = canonicalConceptSchema.parse(concept);
    const container = this.database.container(conceptsContainerId);
    try {
      const { resource } = await container.items.create(data);
      if (!resource) throw new Error(`Cosmos did not return concept ${data.id}.`);
      const saved = canonicalConceptSchema.parse(resource);
      const confirmed = canonicalConceptSchema.parse((await container.item(data.id, data.id).read<unknown>()).resource);
      if (hashContent(saved) !== hashContent(data) || hashContent(confirmed) !== hashContent(data)) {
        throw new Error(`Canonical concept ${data.id} could not be confirmed after creation.`);
      }
      return confirmed;
    } catch (error) {
      if (statusCode(error) !== 409) throw error;
      const { resource } = await container.item(data.id, data.id).read<unknown>();
      return canonicalConceptSchema.parse(resource);
    }
  }

  async pendingReviewQuestionIds(source: QuestionSourceContainer): Promise<Set<string>> {
    const [profiles, questions] = await Promise.all([
      this.database.container(profileContainerId).items.query<unknown>({
        query: 'SELECT c.questionId FROM c WHERE c.sourceContainer = @source AND (c.processing.status = "pending_review" OR c.verification.status = "pending_review")',
        parameters: [{ name: "@source", value: source }],
      }).fetchAll(),
      this.database.container(source).items.query<unknown>(
        'SELECT c.id FROM c WHERE c.verification.status = "pending_review" AND c.id != "__cache_version__" AND IS_STRING(c.question)',
      ).fetchAll(),
    ]);
    return new Set([
      ...profiles.resources.map(resource => z.object({ questionId: z.string().min(1) }).parse(resource).questionId),
      ...questions.resources.map(resource => z.object({ id: z.union([z.string(), z.number()]).transform(String) }).parse(resource).id),
    ]);
  }

  async *questionReferences(source: QuestionSourceContainer, limit: number): AsyncGenerator<QuestionReference> {
    const query = this.database.container(source).items.query<unknown>(
      'SELECT c.id FROM c WHERE IS_STRING(c.question) AND c.question != "" AND c.id != "__cache_version__" AND NOT STARTSWITH(c.question, "Q_") AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false) ORDER BY c.id',
      { maxItemCount: Math.min(limit, 100) },
    );
    let count = 0;
    while (query.hasMoreResults() && count < limit) {
      const { resources } = await query.fetchNext();
      for (const resource of resources) {
        if (count >= limit) return;
        const { id } = z.object({ id: z.union([z.string().min(1), z.number().int()]).transform(String) }).parse(resource);
        count++;
        yield { sourceContainer: source, questionId: id };
      }
    }
  }
}

export function createRepository(): CosmosPipelineRepository {
  const config = readStorageConfig();
  const client = new CosmosClient({ endpoint: config.endpoint, key: config.key });
  return new CosmosPipelineRepository(client.database(config.databaseId));
}
