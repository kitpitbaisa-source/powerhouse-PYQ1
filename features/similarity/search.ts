import express from "express";
import { z } from "zod";
import type { Database } from "@azure/cosmos";
import { embeddingModel, embeddingPrefix, profileContainerId, promptVersion, schemaVersion, sourceContainers } from "./config";
import { buildEmbeddingInput, hashContent, validateVector } from "./pipeline";
import { CosmosPipelineRepository, statusCode } from "./repository";
import { profileExtractionSchema, sourceQuestionSchema, storedProfileSchema, type SourceQuestion, type StoredProfile } from "./schema";
import type {
  QuestionReference, QuestionSourceContainer, SimilarityMatch,
  SimilarityQuestionContent, SimilarityResponse,
} from "./types";

const rankingVersion = "concept-cosine-v1";
const maxResults = 12;
const candidateCount = 50;
const requestSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().trim().min(1).max(128).regex(/^[^/\\?#]+$/),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@gmail\.com$/).optional(),
});

export interface SimilarityStore {
  readProfile(id: string): Promise<StoredProfile | undefined>;
  readQuestion(reference: QuestionReference): Promise<SourceQuestion | undefined>;
  userStatus(email: string): Promise<string | undefined>;
  latestYears(sources: QuestionSourceContainer[]): Promise<string[]>;
  candidates(profile: StoredProfile, sources: QuestionSourceContainer[], years?: string[]): Promise<StoredProfile[]>;
}

function bankSources(source: QuestionSourceContainer): QuestionSourceContainer[] {
  return source === "questions" || source === "state_pcs" ? ["questions", "state_pcs"] : [source];
}

function hasReadyVector(profile: StoredProfile): boolean {
  if (profile.processing.status !== "ready" || profile.schemaVersion !== schemaVersion || !profile.embedding) return false;
  if (profile.id !== `${profile.sourceContainer}:${profile.questionId}`) throw new Error("Invalid stored profile identity.");
  const extraction = profileExtractionSchema.parse(profile);
  validateVector(profile.embedding, profile.processing.embeddingDimensions);
  return profile.processing.embeddingModel === embeddingModel &&
    profile.processing.promptVersion === promptVersion &&
    profile.processing.embeddingSpaceVersion === `${embeddingModel}:${profile.processing.embeddingDimensions}:sentence-similarity:normalized:v1` &&
    profile.concept_embedding_input === buildEmbeddingInput(extraction) &&
    profile.processing.embeddingInputHash === hashContent(embeddingPrefix + profile.concept_embedding_input);
}

function questionContent(reference: QuestionReference, question: SourceQuestion): SimilarityQuestionContent {
  if (question.exam === null || question.year === null || question.subject === null) {
    throw new Error(`Source metadata is incomplete for ${reference.sourceContainer}:${reference.questionId}.`);
  }
  const common = {
    ...reference, id: question.id, question: question.question,
    exam: question.exam, year: question.year, subject: question.subject, topic: question.topic,
  };
  return reference.sourceContainer === "mains-questions" || reference.sourceContainer === "essay-questions"
    ? { ...common, kind: "descriptive", paper: question.paper, modelAnswer: question.answer }
    : { ...common, kind: "objective", options: question.options, answer: question.answer, explanation: question.explanation };
}

function cosineScore(source: StoredProfile, candidate: StoredProfile): number {
  const left = validateVector(source.embedding, source.processing.embeddingDimensions);
  const right = validateVector(candidate.embedding, source.processing.embeddingDimensions);
  return Math.max(-1, Math.min(1, left.reduce((sum, value, index) => sum + value * right[index], 0)));
}

function explainMatch(source: StoredProfile, candidate: StoredProfile): Pick<SimilarityMatch, "relation" | "reasons" | "sharedConcepts"> {
  const primary = new Set(source.concept_profile.primary_concepts.map(concept => concept.concept_id));
  const all = new Set([...primary, ...source.concept_profile.secondary_concepts.map(concept => concept.concept_id)]);
  const targetPrimary = candidate.concept_profile.primary_concepts;
  const targetAll = [...targetPrimary, ...candidate.concept_profile.secondary_concepts];
  const shared = targetAll.filter(concept => all.has(concept.concept_id));
  const samePrimary = primary.size === targetPrimary.length && targetPrimary.every(concept => primary.has(concept.concept_id));
  return {
    relation: samePrimary ? "same_concept" : shared.length ? "partial_concept_overlap" : "related_concept",
    reasons: shared.length
      ? [`Shared concepts: ${shared.map(concept => concept.canonical_name).join("; ")}`]
      : ["Similar concept descriptions based on the stored embeddings."],
    sharedConcepts: shared.map(concept => ({ conceptId: concept.concept_id, canonicalName: concept.canonical_name })),
  };
}

export async function findSimilarQuestions(
  reference: QuestionReference,
  email: string | undefined,
  store: SimilarityStore,
  permanentAdmins: readonly string[] = [],
): Promise<SimilarityResponse> {
  const profile = await store.readProfile(`${reference.sourceContainer}:${reference.questionId}`);
  if (!profile || !hasReadyVector(profile)) {
    const status = profile?.processing.status === "failed" ? "failed"
      : profile?.processing.status === "stale" || profile?.processing.status === "ready" ? "stale" : "pending";
    return { status, source: reference, matches: [], message: "No ready concept profile is available for this question." };
  }
  const sourceQuestion = await store.readQuestion(reference);
  if (!sourceQuestion || !sourceQuestion.isActive || hashContent(sourceQuestion) !== profile.processing.sourceContentHash) {
    return { status: "stale", source: reference, matches: [], message: "The concept profile needs updating." };
  }
  const subscribed = email && (permanentAdmins.includes(email) ||
    ["subscribed", "admin", "editor"].includes(await store.userStatus(email) ?? ""));
  const sources = bankSources(reference.sourceContainer);
  const years = subscribed ? undefined : await store.latestYears(sources);
  if (years && !years.includes(sourceQuestion.year)) {
    return { status: "ready", source: reference, rankingVersion, matches: [] };
  }
  const candidates = await store.candidates(profile, sources, years);
  const seen = new Set([profile.id]);
  const ranked: { profile: StoredProfile; cosine: number }[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    if (!sources.includes(candidate.sourceContainer) || !hasReadyVector(candidate) ||
        candidate.processing.embeddingSpaceVersion !== profile.processing.embeddingSpaceVersion ||
        candidate.processing.taxonomyVersion !== profile.processing.taxonomyVersion ||
        candidate.processing.embeddingModel !== profile.processing.embeddingModel ||
        candidate.processing.embeddingDimensions !== profile.processing.embeddingDimensions) continue;
    const cosine = cosineScore(profile, candidate);
    if (cosine > 0) ranked.push({ profile: candidate, cosine });
  }
  ranked.sort((a, b) => b.cosine - a.cosine || a.profile.id.localeCompare(b.profile.id));
  const matches: SimilarityMatch[] = [];
  for (let offset = 0; offset < ranked.length && matches.length < maxResults; offset += maxResults) {
    const batch = await Promise.all(ranked.slice(offset, offset + maxResults).map(async candidate => ({
      ...candidate,
      question: await store.readQuestion(candidate.profile),
    })));
    for (const candidate of batch) {
      const { question } = candidate;
      if (!question || !question.isActive || hashContent(question) !== candidate.profile.processing.sourceContentHash ||
          (years && !years.includes(question.year))) continue;
      const target: QuestionReference = {
        sourceContainer: candidate.profile.sourceContainer, questionId: candidate.profile.questionId,
      };
      const explanation = explainMatch(profile, candidate.profile);
      matches.push({
        ...target,
        profileId: `${target.sourceContainer}:${target.questionId}`,
        score: Math.round(candidate.cosine * 100),
        ...explanation,
        highlights: candidate.profile.highlight_evidence,
        question: questionContent(target, question),
      });
      if (matches.length === maxResults) break;
    }
  }
  return {
    status: "ready", source: reference, rankingVersion, matches,
    sourceHighlights: profile.highlight_evidence,
  };
}

class CosmosSimilarityStore implements SimilarityStore {
  private readonly repository: CosmosPipelineRepository;
  constructor(private readonly database: Database) {
    this.repository = new CosmosPipelineRepository(database);
  }
  async readProfile(id: string) {
    return (await this.repository.readProfile(id))?.document;
  }
  async readQuestion(reference: QuestionReference): Promise<SourceQuestion | undefined> {
    try {
      const { resource } = await this.database.container(reference.sourceContainer)
        .item(reference.questionId, reference.questionId).read<unknown>();
      if (!resource) return undefined;
      const question = sourceQuestionSchema.parse(resource);
      if (question.id !== reference.questionId) throw new Error("Source question identity does not match its reference.");
      return question.isActive && !question.question.startsWith("Q_") ? question : undefined;
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }
  async userStatus(email: string): Promise<string | undefined> {
    try {
      const { resource } = await this.database.container("users").item(email, email).read<unknown>();
      if (!resource) return undefined;
      return z.object({ status: z.string() }).parse(resource).status;
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }
  async latestYears(sources: QuestionSourceContainer[]): Promise<string[]> {
    const batches = await Promise.all(sources.map(async source => {
      try {
        const { resources } = await this.database.container(source).items.query<unknown>(
          'SELECT DISTINCT VALUE c.year FROM c WHERE IS_STRING(c.question) AND c.question != "" AND NOT STARTSWITH(c.question, "Q_") AND (IS_STRING(c.year) OR IS_NUMBER(c.year)) AND (NOT IS_DEFINED(c.isActive) OR c.isActive != false)',
        ).fetchAll();
        return resources.map(value => z.union([z.string(), z.number()]).parse(value)).map(String);
      } catch (error) {
        if (source === "state_pcs" && statusCode(error) === 404) {
          console.warn("State PCS container is unavailable for similarity search; using the base Prelims bank.");
          return [];
        }
        throw error;
      }
    }));
    return [...new Set(batches.flat().filter(year => /^\d{4}$/.test(year)))].sort().reverse().slice(0, 2);
  }
  async candidates(profile: StoredProfile, sources: QuestionSourceContainer[], years?: string[]): Promise<StoredProfile[]> {
    const { resources } = await this.database.container(profileContainerId).items.query<unknown>({
      query: `SELECT TOP @count VALUE c FROM c
        WHERE c.id != @id AND c.processing.status = "ready"
        AND c.schemaVersion = @schema AND IS_ARRAY(c.embedding)
        AND c.processing.embeddingSpaceVersion = @space
        AND c.processing.embeddingModel = @model
        AND c.processing.embeddingDimensions = @dimensions
        AND c.processing.promptVersion = @prompt
        AND c.processing.taxonomyVersion = @taxonomy
        AND ARRAY_CONTAINS(@sources, c.sourceContainer)
        ${years ? "AND ARRAY_CONTAINS(@years, c.sourceMetadata.year)" : ""}
        ORDER BY VectorDistance(c.embedding, @vector)`,
      parameters: [
        { name: "@count", value: candidateCount }, { name: "@id", value: profile.id },
        { name: "@schema", value: schemaVersion }, { name: "@space", value: profile.processing.embeddingSpaceVersion },
        { name: "@model", value: profile.processing.embeddingModel },
        { name: "@dimensions", value: profile.processing.embeddingDimensions },
        { name: "@prompt", value: profile.processing.promptVersion },
        { name: "@taxonomy", value: profile.processing.taxonomyVersion },
        { name: "@sources", value: sources }, { name: "@vector", value: profile.embedding },
        ...(years ? [{ name: "@years", value: years }] : []),
      ],
    }).fetchAll();
    return resources.map(resource => storedProfileSchema.parse(resource));
  }
}

export function createSimilarityRouter(database: Database, permanentAdmins: readonly string[]) {
  const router = express.Router();
  const store = new CosmosSimilarityStore(database);
  router.get("/", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const parsed = requestSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "A valid sourceContainer, questionId, and optional Gmail email are required." });
    try {
      const { sourceContainer, questionId, email } = parsed.data;
      return res.json(await findSimilarQuestions({ sourceContainer, questionId }, email, store, permanentAdmins));
    } catch (error) {
      console.error("Similarity search failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not load similar questions." });
    }
  });
  return router;
}
