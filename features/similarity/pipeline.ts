import { createHash } from "node:crypto";
import { embeddingModel, embeddingPrefix, promptVersion, schemaVersion, type PipelineConfig } from "./config.js";
import {
  importedExtractionSchema, profileExtractionSchema, validateExtraction,
  type ExtractionResponse, type ImportedExtraction, type ProfileExtraction, type SourceQuestion, type StoredProfile,
} from "./schema.js";
import type { EmbeddingAI, PipelineAI } from "./google.js";
import type { PipelineRepository, ProfileSnapshot } from "./repository.js";
import type { CanonicalConcept, QuestionReference } from "./types.js";

export function hashContent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildEmbeddingInput(extraction: ProfileExtraction): string {
  const profile = extraction.concept_profile;
  const names = (items: typeof profile.primary_concepts | typeof profile.secondary_concepts) =>
    [...items].sort((a, b) => a.concept_id.localeCompare(b.concept_id))
      .map(item => item.canonical_name).join("; ");
  const entities = new Map(profile.entities.map(entity => [entity.entity_id, entity.name]));
  const relationships = profile.relationships
    .filter(relation => relation.role === "tested_relationship")
    .map(relation => `${entities.get(relation.subject_entity_id)}: ${relation.relationship_type.replaceAll("_", " ")}${relation.object_entity_id ? `: ${entities.get(relation.object_entity_id)}` : ""}`)
    .sort();
  return [
    `Subject/topic: ${extraction.classification.subject}; ${extraction.classification.topic}.`,
    `Primary concepts: ${names(profile.primary_concepts)}.`,
    `Underlying principle: ${profile.underlying_principle}`,
    `Essential knowledge: ${[...profile.knowledge_requirements].sort().join("; ")}`,
    ...(profile.secondary_concepts.length ? [`Supporting concepts: ${names(profile.secondary_concepts)}.`] : []),
    ...(relationships.length ? [`Tested relationships: ${relationships.join("; ")}.`] : []),
  ].join("\n");
}

export function validateVector(vector: number[], dimensions: number): number[] {
  if (vector.length !== dimensions || !vector.every(Number.isFinite)) {
    throw new Error(`Embedding must contain exactly ${dimensions} finite numbers.`);
  }
  const magnitude = Math.hypot(...vector);
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Embedding has an invalid magnitude.");
  return vector.map(value => value / magnitude);
}

const normalizeLabel = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export async function resolveConcepts(
  extraction: ExtractionResponse,
  registry: CanonicalConcept[],
  repository: PipelineRepository,
  taxonomyVersion: string,
): Promise<ProfileExtraction> {
  const mappings = new Map<string, CanonicalConcept>();
  const definitions = extraction.concept_definitions;
  for (const definition of definitions) {
    const idMatch = registry.find(concept => concept.id === definition.id);
    const label = normalizeLabel(definition.canonical_name);
    const labelMatches = registry.filter(concept =>
      [concept.canonical_name, ...concept.aliases].some(name => normalizeLabel(name) === label));
    if (labelMatches.length > 1) throw new Error(`Ambiguous canonical concept name: ${definition.canonical_name}`);
    if (idMatch && ![idMatch.canonical_name, ...idMatch.aliases].some(name => normalizeLabel(name) === label)) {
      throw new Error(`Concept ID ${definition.id} conflicts with its existing meaning.`);
    }
    if (idMatch && labelMatches[0] && idMatch.id !== labelMatches[0].id) {
      throw new Error(`Concept ID and name resolve to different concepts: ${definition.id}`);
    }
    let concept = idMatch ?? labelMatches[0];
    if (concept?.status === "retired") throw new Error(`Concept ${concept.id} is retired and needs review.`);
    if (!concept) {
      const parents = definition.parentConceptIds;
      if (parents.includes(definition.id) ||
          parents.some(id => !registry.some(item => item.id === id && item.status !== "retired"))) {
        throw new Error(`Concept ${definition.id} has an invalid parent reference.`);
      }
      concept = await repository.createConcept({
        ...definition, status: "provisional", taxonomyVersion,
      });
      if (concept.status === "retired" || normalizeLabel(concept.canonical_name) !== label) {
        throw new Error(`Concept ${definition.id} was concurrently created with a different meaning.`);
      }
      registry.push(concept);
    }
    mappings.set(definition.id, concept);
  }
  const remap = (id: string) => {
    const concept = mappings.get(id);
    if (!concept) throw new Error(`Undefined concept mapping: ${id}`);
    return concept;
  };
  const assignments = (items: ProfileExtraction["concept_profile"]["primary_concepts"] |
    ProfileExtraction["concept_profile"]["secondary_concepts"]) =>
    items.map(item => ({
      ...item, concept_id: remap(item.concept_id).id,
      canonical_name: remap(item.concept_id).canonical_name,
    }));
  const primary = assignments(extraction.concept_profile.primary_concepts);
  const secondary = assignments(extraction.concept_profile.secondary_concepts);
  if (new Set([...primary, ...secondary].map(item => item.concept_id)).size !== primary.length + secondary.length) {
    throw new Error("Multiple extracted concepts resolve to the same canonical ID; extraction needs review.");
  }
  const provisional = [...mappings.values()].filter(concept => concept.status === "provisional");
  return profileExtractionSchema.parse({
    ...extraction,
    concept_profile: {
      ...extraction.concept_profile,
      primary_concepts: primary,
      secondary_concepts: secondary,
    },
    claims: extraction.claims.map(claim => ({
      ...claim, concept_ids: [...new Set(claim.concept_ids.map(id => remap(id).id))],
    })),
    ...(extraction.highlight_evidence ? {
      highlight_evidence: extraction.highlight_evidence.map(highlight => ({
        ...highlight, concept_id: remap(highlight.concept_id).id,
      })),
    } : {}),
    provenance: {
      ...extraction.provenance,
      needs_review: extraction.provenance.needs_review || provisional.length > 0,
      review_notes: [
        ...extraction.provenance.review_notes,
        ...(provisional.length ? [`Provisional concepts: ${provisional.map(concept => concept.id).join(", ")}`] : []),
      ],
    },
  });
}

class StaleSourceError extends Error {}

export class ConceptPipeline {
  private concepts: CanonicalConcept[] | undefined;

  constructor(
    private readonly repository: PipelineRepository,
    private readonly ai: PipelineAI | EmbeddingAI,
    private readonly config: PipelineConfig,
  ) {}

  async processImported(entry: ImportedExtraction, force = false): Promise<"ready" | "skipped"> {
    const imported = importedExtractionSchema.parse(entry);
    return this.process({ sourceContainer: imported.sourceContainer, questionId: imported.questionId }, force, imported);
  }

  async process(reference: QuestionReference, force = false, imported?: ImportedExtraction): Promise<"ready" | "skipped"> {
    const id = `${reference.sourceContainer}:${reference.questionId}`;
    const question = await this.repository.readQuestion(reference);
    const sourceHash = hashContent(question);
    if (imported && imported.sourceContentHash !== sourceHash) {
      throw new Error(`Imported extraction for ${id} has an outdated source hash; extract the current question again.`);
    }
    const importedResponse = imported ? validateExtraction(imported.extraction, question) : undefined;
    const extractionContentHash = importedResponse ? hashContent(importedResponse) : undefined;
    const existing = await this.repository.readProfile(id);
    const previous = existing?.document;
    const sameExtraction = previous?.processing.sourceContentHash === sourceHash &&
      previous.schemaVersion === schemaVersion &&
      previous.processing.promptVersion === promptVersion &&
      previous.processing.taxonomyVersion === this.config.taxonomyVersion &&
      previous.processing.extractionModel === this.config.extractionModel &&
      (!imported || previous.processing.extractionContentHash === extractionContentHash);
    if (!force && sameExtraction && previous.processing.status === "ready" &&
        previous.processing.embeddingSpaceVersion === this.config.embeddingSpaceVersion) {
      const extraction = profileExtractionSchema.parse(previous);
      const input = buildEmbeddingInput(extraction);
      if (previous.concept_embedding_input === input &&
          previous.processing.embeddingInputHash === hashContent(`${embeddingPrefix}${input}`) &&
          previous.processing.embeddingDimensions === this.config.dimensions &&
          previous.processing.embeddingModel === embeddingModel && previous.embedding !== null) {
        validateVector(previous.embedding, this.config.dimensions);
        return "skipped";
      }
    }
    if (previous && ["extracting", "embedding"].includes(previous.processing.status) &&
        Date.now() - Date.parse(previous.processing.updatedAt) < 15 * 60_000) {
      throw new Error(`Profile ${id} is already processing. Retry after the lease expires.`);
    }
    const reusable = !force && sameExtraction && previous?.classification
      ? profileExtractionSchema.parse(previous) : undefined;
    let document: StoredProfile = {
      id, ...reference, schemaVersion,
      sourceMetadata: { exam: question.exam, year: question.year, paper: question.paper },
      ...(reusable ?? {}),
      concept_embedding_input: "",
      embedding: null,
      processing: {
        status: reusable ? "embedding" : "extracting",
        sourceContentHash: sourceHash,
        embeddingInputHash: null,
        promptVersion,
        taxonomyVersion: this.config.taxonomyVersion,
        extractionModel: this.config.extractionModel,
        ...(extractionContentHash ? { extractionContentHash } : {}),
        embeddingModel,
        embeddingDimensions: this.config.dimensions,
        embeddingSpaceVersion: this.config.embeddingSpaceVersion,
        updatedAt: new Date().toISOString(),
        error: null,
      },
    };
    let snapshot: ProfileSnapshot = await this.repository.saveProfile(document, existing?.etag);
    const persist = async () => {
      document.processing.updatedAt = new Date().toISOString();
      snapshot = await this.repository.saveProfile(document, snapshot.etag);
    };
    try {
      let extraction = reusable;
      if (!extraction) {
        this.concepts ??= await this.repository.listConcepts();
        let response = importedResponse;
        if (!response) {
          if (!("extract" in this.ai)) throw new Error("This embedding-only provider requires an imported extraction.");
          response = validateExtraction(await this.ai.extract(question, this.concepts), question);
        }
        extraction = await resolveConcepts(response, this.concepts, this.repository, this.config.taxonomyVersion);
      }
      const input = buildEmbeddingInput(extraction);
      document = {
        ...document, ...extraction,
        concept_embedding_input: input,
        processing: {
          ...document.processing, status: "pending_embedding",
          embeddingInputHash: hashContent(`${embeddingPrefix}${input}`),
        },
      };
      await persist();
      document.processing.status = "embedding";
      await persist();
      const reuseVector = !force && imported && previous?.processing.status === "ready" &&
        previous.processing.sourceContentHash === sourceHash &&
        previous.processing.embeddingSpaceVersion === this.config.embeddingSpaceVersion &&
        previous.processing.embeddingModel === embeddingModel &&
        previous.processing.embeddingDimensions === this.config.dimensions &&
        previous.concept_embedding_input === input &&
        previous.processing.embeddingInputHash === hashContent(`${embeddingPrefix}${input}`) &&
        previous.embedding !== null;
      const vector = reuseVector ? previous.embedding : await this.ai.embed(input);
      const normalized = validateVector(vector, this.config.dimensions);
      const latest = await this.repository.readQuestion(reference);
      if (hashContent(latest) !== sourceHash) throw new StaleSourceError(`Source question ${id} changed during processing.`);
      document.embedding = reuseVector ? vector : normalized;
      document.processing.status = "ready";
      await persist();
      return "ready";
    } catch (error) {
      document.embedding = null;
      document.processing.status = error instanceof StaleSourceError ? "stale" : "failed";
      const code = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      document.processing.error = typeof code === "number"
        ? `AI request failed with HTTP ${code}.`
        : error instanceof Error ? error.message : "Pipeline failed with a non-Error exception.";
      try {
        await persist();
      } catch (saveError) {
        throw new AggregateError([error, saveError], `Profile ${id} failed and its failure status could not be persisted.`);
      }
      throw new Error(`Profile ${id}: ${document.processing.error}`, { cause: error });
    }
  }
}
