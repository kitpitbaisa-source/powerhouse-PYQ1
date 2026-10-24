import express from "express";
import { z } from "zod";
import type { Database } from "@azure/cosmos";
import { embeddingModel, embeddingPrefix, profileContainerId, promptVersion, schemaVersion, sourceContainers } from "./config.js";
import { buildEmbeddingInput, buildProvisionalEmbeddingInput, provisionalEmbeddingReview, hashContent, validateVector } from "./pipeline.js";
import { CosmosPipelineRepository, statusCode } from "./repository.js";
import { classificationReviewIssue, conceptReviewIssue, profileExtractionSchema, sourceQuestionSchema, storedProfileSchema, type SourceQuestion, type StoredProfile } from "./schema.js";
import type {
  QuestionReference, QuestionSourceContainer, SharedConcept, SimilarityMatch,
  SimilarityQuestionContent, SimilarityResponse,
} from "./types.js";
import { questionVerificationSchema, type QuestionVerification } from "./verification.js";
import { feedbackSchema, saveSimilarityFeedback } from "./feedback.js";
import { similarityCacheTags, similarityCdnCacheControl } from "./cache-tags.js";
import { readRuntimeSimilarity, similarityRuntimeKey, writeRuntimeSimilarity } from "./runtime-cache.js";
import type { MasterRecord } from "../taxonomy/master.js";
import { approvedMasterSubtopics, approvedQuestionSubject, loadActiveSubtopicMaster } from "./subtopics.js";

const rankingVersion = "concept-cosine-overlap-v7";
// Score = 0.9 * embedding cosine + a bonus by shared concept IDs (1+ = 0.10, none = 0.075), so 100% needs a perfect cosine.
const cosineWeight = 0.9;
const sharedConceptBonus = (sharedCount: number) => sharedCount >= 1 ? 0.1 : 0.075;
const maxResults = 12;
const candidateCount = 50;
const requestSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().trim().min(1).max(128).regex(/^[^/\\?#]+$/),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@gmail\.com$/).optional(),
  tier: z.enum(["free", "full"]).optional(),
});

export interface SimilarityStore {
  readSubtopicMaster(): Promise<MasterRecord[]>;
  readProfile(id: string): Promise<StoredProfile | undefined>;
  readQuestion(reference: QuestionReference): Promise<{ question: SourceQuestion; verification?: QuestionVerification } | undefined>;
  userStatus(email: string): Promise<string | undefined>;
  latestYears(sources: QuestionSourceContainer[]): Promise<string[]>;
  candidates(profile: StoredProfile, sources: QuestionSourceContainer[], years?: string[]): Promise<StoredProfile[]>;
}

function bankSources(source: QuestionSourceContainer): QuestionSourceContainer[] {
  return source === "questions" || source === "state_pcs" ? ["questions", "state_pcs"] : [source];
}

function hasReadyVector(profile: StoredProfile): boolean {
  const provisional = provisionalEmbeddingReview(profile);
  if (profile.processing.provisionalEmbedding && !provisional) return false;
  if (profile.verification?.status === "pending_review" && !provisional) return false;
  if (profile.processing.status !== "ready" || profile.schemaVersion !== schemaVersion || !profile.embedding) return false;
  if (profile.id !== `${profile.sourceContainer}:${profile.questionId}`) throw new Error("Invalid stored profile identity.");
  const extraction = profileExtractionSchema.parse(profile);
  if (!provisional && (classificationReviewIssue(extraction) || conceptReviewIssue(extraction))) return false;
  validateVector(profile.embedding, profile.processing.embeddingDimensions);
  return profile.processing.embeddingModel === embeddingModel &&
    profile.processing.promptVersion === promptVersion &&
    profile.processing.embeddingSpaceVersion === `${embeddingModel}:${profile.processing.embeddingDimensions}:sentence-similarity:normalized:v1` &&
    profile.concept_embedding_input === (provisional ? buildProvisionalEmbeddingInput(extraction) : buildEmbeddingInput(extraction)) &&
    profile.processing.embeddingInputHash === hashContent(embeddingPrefix + profile.concept_embedding_input);
}

function allowsFlaggedSource(profile: StoredProfile, verification?: QuestionVerification): boolean {
  const review = provisionalEmbeddingReview(profile);
  return !!review && review.sourceVerificationHash === hashContent(verification ?? null);
}

function reviewNotices(profile: StoredProfile, verification?: QuestionVerification) {
  const notices = [
    ...(verification?.warnings ?? []).map(({ code, reason }) => ({ code, reason })),
    ...(provisionalEmbeddingReview(profile)?.issues ?? []),
  ];
  return [...new Map(notices.map(notice => [`${notice.code}:${notice.reason}`, notice])).values()];
}

function questionContent(
  reference: QuestionReference, question: SourceQuestion, subtopics: string[],
  master: readonly MasterRecord[], verification?: QuestionVerification, profile?: StoredProfile,
): SimilarityQuestionContent {
  if (question.exam === null || question.year === null || question.subject === null) {
    throw new Error(`Source metadata is incomplete for ${reference.sourceContainer}:${reference.questionId}.`);
  }
  const notices = profile ? reviewNotices(profile, verification)
    : (verification?.warnings ?? []).map(({ code, reason }) => ({ code, reason }));
  const common = {
    ...reference, id: question.id, question: question.question,
    exam: question.exam, year: question.year, subject: question.subject, topic: question.topic, subtopics,
    subjectClassification: approvedQuestionSubject({ ...question, verification }, master),
    ...(notices.length ? { reviewWarnings: notices } : {}),
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
  if (provisionalEmbeddingReview(source) || provisionalEmbeddingReview(candidate)) return {
    relation: "related_concept",
    reasons: ["Provisional embedding similarity. Source claims and concept identities retain their review flags."],
    sharedConcepts: [],
  };
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

function allConcepts(profile: StoredProfile): SharedConcept[] {
  const seen = new Set<string>();
  return [...profile.concept_profile.primary_concepts, ...profile.concept_profile.secondary_concepts]
    .filter(concept => !seen.has(concept.concept_id) && seen.add(concept.concept_id))
    .map(concept => ({ conceptId: concept.concept_id, canonicalName: concept.canonical_name }));
}

export const similarityPurgeWindow = 30;

export async function findSimilarQuestions(
  reference: QuestionReference,
  email: string | undefined,
  store: SimilarityStore,
  permanentAdmins: readonly string[] = [],
  options: { tier?: "free" | "full"; limit?: number } = {},
): Promise<SimilarityResponse> {
  const limit = Math.min(options.limit ?? maxResults, candidateCount);
  const profile = await store.readProfile(`${reference.sourceContainer}:${reference.questionId}`);
  if (!profile || !hasReadyVector(profile)) {
    const pendingReview = profile?.verification?.status === "pending_review" || profile?.processing.status === "pending_review";
    const status = pendingReview ? "pending" : profile?.processing.status === "failed" ? "failed"
      : profile?.processing.status === "stale" || profile?.processing.status === "ready" ? "stale" : "pending";
    return {
      status, source: reference, matches: [],
      message: pendingReview
        ? "Question verification or concept review is required before similarity matching."
        : "No ready concept profile is available for this question.",
    };
  }
  const sourceSnapshot = await store.readQuestion(reference);
  const sourceQuestion = sourceSnapshot?.question;
  if (!sourceQuestion || !sourceQuestion.isActive || hashContent(sourceQuestion) !== profile.processing.sourceContentHash) {
    return { status: "stale", source: reference, matches: [], message: "The concept profile needs updating." };
  }
  if ((profile.processing.provisionalEmbedding && !allowsFlaggedSource(profile, sourceSnapshot.verification)) ||
      (sourceSnapshot.verification?.status === "pending_review" && !allowsFlaggedSource(profile, sourceSnapshot.verification))) {
    return { status: "pending", source: reference, matches: [], message: sourceSnapshot.verification.reason };
  }
  if (sourceSnapshot.verification?.status === "verified" &&
      (sourceSnapshot.verification.sourceContentHash !== profile.processing.sourceContentHash ||
        sourceSnapshot.verification.extractionContentHash !== profile.processing.extractionContentHash)) {
    return { status: "stale", source: reference, matches: [], message: "The concept profile does not match the question's reviewed version." };
  }
  const subscribed = options.tier ? options.tier === "full" : email && (permanentAdmins.includes(email) ||
    ["subscribed", "admin", "editor"].includes(await store.userStatus(email) ?? ""));
  const sources = bankSources(reference.sourceContainer);
  const years = subscribed ? undefined : await store.latestYears(sources);
  if (years && !years.includes(sourceQuestion.year)) {
    return { status: "ready", source: reference, rankingVersion, matches: [] };
  }
  const subtopicMaster = await store.readSubtopicMaster();
  const candidates = await store.candidates(profile, sources, years);
  const seen = new Set([profile.id]);
  const ranked: { profile: StoredProfile; score: number; explanation: ReturnType<typeof explainMatch> }[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    if (!sources.includes(candidate.sourceContainer) || !hasReadyVector(candidate) ||
        candidate.processing.embeddingSpaceVersion !== profile.processing.embeddingSpaceVersion ||
        candidate.processing.taxonomyVersion !== profile.processing.taxonomyVersion ||
        candidate.processing.embeddingModel !== profile.processing.embeddingModel ||
        candidate.processing.embeddingDimensions !== profile.processing.embeddingDimensions) continue;
    const cosine = cosineScore(profile, candidate);
    if (cosine <= 0) continue;
    const explanation = explainMatch(profile, candidate);
    const shared = new Set(explanation.sharedConcepts.map(concept => concept.conceptId)).size;
    ranked.push({ profile: candidate, score: cosineWeight * cosine + sharedConceptBonus(shared), explanation });
  }
  ranked.sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id));
  const matches: SimilarityMatch[] = [];
  for (let offset = 0; offset < ranked.length && matches.length < limit; offset += limit) {
    const batch = await Promise.all(ranked.slice(offset, offset + limit).map(async candidate => ({
      ...candidate,
      snapshot: await store.readQuestion(candidate.profile),
    })));
    for (const candidate of batch) {
      const question = candidate.snapshot?.question;
      const verification = candidate.snapshot?.verification;
      if (!question || !question.isActive || hashContent(question) !== candidate.profile.processing.sourceContentHash ||
          (candidate.profile.processing.provisionalEmbedding && !allowsFlaggedSource(candidate.profile, verification)) ||
          (verification?.status === "pending_review" && !allowsFlaggedSource(candidate.profile, verification)) ||
          (verification?.status === "verified" &&
            (verification.sourceContentHash !== candidate.profile.processing.sourceContentHash ||
              verification.extractionContentHash !== candidate.profile.processing.extractionContentHash)) ||
          (years && !years.includes(question.year))) continue;
      const target: QuestionReference = {
        sourceContainer: candidate.profile.sourceContainer, questionId: candidate.profile.questionId,
      };
      const explanation = candidate.explanation;
      matches.push({
        ...target,
        profileId: `${target.sourceContainer}:${target.questionId}`,
        score: Math.round(candidate.score * 100),
        ...explanation,
        allConcepts: allConcepts(candidate.profile),
        highlights: candidate.profile.highlight_evidence,
        question: questionContent(target, question, approvedMasterSubtopics(candidate.profile.classification, subtopicMaster), subtopicMaster, verification, candidate.profile),
      });
      if (matches.length === limit) break;
    }
  }
  return {
    status: "ready", source: reference, rankingVersion, matches,
    sourceHighlights: profile.highlight_evidence,
    sourceConcepts: allConcepts(profile),
    sourceSubtopics: approvedMasterSubtopics(profile.classification, subtopicMaster),
    ...(reviewNotices(profile, sourceSnapshot.verification).length ? {
      sourceWarnings: reviewNotices(profile, sourceSnapshot.verification),
    } : {}),
  };
}

export class CosmosSimilarityStore implements SimilarityStore {
  private readonly repository: CosmosPipelineRepository;
  constructor(private readonly database: Database) {
    this.repository = new CosmosPipelineRepository(database);
  }
  async readSubtopicMaster() {
    return loadActiveSubtopicMaster(this.database);
  }
  async readProfile(id: string) {
    return (await this.repository.readProfile(id))?.document;
  }
  async readQuestion(reference: QuestionReference) {
    try {
      const { resource } = await this.database.container(reference.sourceContainer)
        .item(reference.questionId, reference.questionId).read<unknown>();
      if (!resource) return undefined;
      const question = sourceQuestionSchema.parse(resource);
      if (question.id !== reference.questionId) throw new Error("Source question identity does not match its reference.");
      return question.isActive && !question.question.startsWith("Q_") ? {
        question,
        verification: z.object({ verification: questionVerificationSchema.optional() }).parse(resource).verification,
      } : undefined;
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
    const query = {
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
    };
    const { resources } = await this.database.container(profileContainerId).items.query<unknown>(query).fetchAll();
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
      const { sourceContainer, questionId, email, tier } = parsed.data;
      const runtimeKey = tier ? similarityRuntimeKey(sourceContainer, questionId, tier) : undefined;
      const stored = runtimeKey ? await readRuntimeSimilarity(runtimeKey) : undefined;
      const result = stored ?? await findSimilarQuestions({ sourceContainer, questionId }, email, store, permanentAdmins, { tier });
      if (tier && result.status === "ready") {
        const tags = similarityCacheTags(result.source, result.matches);
        if (runtimeKey && !stored) await writeRuntimeSimilarity(runtimeKey, result, tags);
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        res.setHeader("Vercel-CDN-Cache-Control", similarityCdnCacheControl);
        res.setHeader("Vercel-Cache-Tag", tags.join(","));
      }
      return res.json(result);
    } catch (error) {
      console.error("Similarity search failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not load similar questions." });
    }
  });
  router.post("/feedback", async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid feedback." });
    try {
      await saveSimilarityFeedback(database, parsed.data, rankingVersion);
      return res.status(204).end();
    } catch (error) {
      console.error("Similarity feedback failed:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Could not save feedback." });
    }
  });
  return router;
}
