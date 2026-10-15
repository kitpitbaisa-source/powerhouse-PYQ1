import {
  CosmosClient, PartitionKeyKind, VectorEmbeddingDataType,
  VectorEmbeddingDistanceFunction, VectorIndexType,
  type ContainerDefinition, type Database,
} from "@azure/cosmos";
import { z } from "zod";
import { conceptsContainerId, profileContainerId, readStorageConfig } from "./config";
import {
  canonicalConceptSchema, sourceQuestionSchema, storedProfileSchema,
  type SourceQuestion, type StoredProfile,
} from "./schema";
import type { CanonicalConcept, QuestionReference, QuestionSourceContainer } from "./types";

export interface ProfileSnapshot {
  document: StoredProfile;
  etag: string;
}

export interface PipelineRepository {
  readQuestion(reference: QuestionReference): Promise<SourceQuestion>;
  readProfile(id: string): Promise<ProfileSnapshot | undefined>;
  saveProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot>;
  listConcepts(): Promise<CanonicalConcept[]>;
  createConcept(concept: CanonicalConcept): Promise<CanonicalConcept>;
}

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
  constructor(readonly database: Database) {}

  async readQuestion(reference: QuestionReference): Promise<SourceQuestion> {
    const { resource } = await this.database.container(reference.sourceContainer)
      .item(reference.questionId, reference.questionId).read<unknown>();
    if (!resource) throw new Error(`Source question ${reference.sourceContainer}:${reference.questionId} was not found.`);
    const question = sourceQuestionSchema.parse(resource);
    if (!question.isActive || question.id === "__cache_version__" || question.question.startsWith("Q_")) {
      throw new Error(`Source question ${reference.sourceContainer}:${reference.questionId} is not active content.`);
    }
    if (question.id !== reference.questionId) throw new Error("Source question identity does not match its reference.");
    return question;
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

  async listConcepts(): Promise<CanonicalConcept[]> {
    const { resources } = await this.database.container(conceptsContainerId).items
      .query<unknown>("SELECT * FROM c").fetchAll();
    return resources.map(resource => canonicalConceptSchema.parse(resource));
  }

  async createConcept(concept: CanonicalConcept): Promise<CanonicalConcept> {
    const data = canonicalConceptSchema.parse(concept);
    const container = this.database.container(conceptsContainerId);
    try {
      const { resource } = await container.items.create(data);
      if (!resource) throw new Error(`Cosmos did not return concept ${data.id}.`);
      return canonicalConceptSchema.parse(resource);
    } catch (error) {
      if (statusCode(error) !== 409) throw error;
      const { resource } = await container.item(data.id, data.id).read<unknown>();
      return canonicalConceptSchema.parse(resource);
    }
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
