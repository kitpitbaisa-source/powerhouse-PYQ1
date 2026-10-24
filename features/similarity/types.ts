import type { ConceptReview, StoredProfile } from "./schema.js";
import type { QuestionVerification } from "./verification.js";

export type QuestionSourceContainer =
  | "questions"
  | "state_pcs"
  | "mains-questions"
  | "essay-questions"
  | "csat-questions"
  | "english-questions";

export type QuestionProfileId = `${QuestionSourceContainer}:${string}`;

export interface QuestionReference {
  sourceContainer: QuestionSourceContainer;
  questionId: string;
}

export type ConceptRole = "primary" | "secondary" | "prerequisite" | "application";
export type TruthStatus = "true" | "false" | "partially_true" | "ambiguous" | "unknown";
export type VerificationSource =
  | "provided_answer"
  | "provided_explanation"
  | "official_source"
  | "trusted_external_source"
  | "not_provided"
  | "conflicting_sources";

export type AnswerStatus =
  | "provided_not_independently_verified"
  | "independently_verified"
  | "missing"
  | "conflict_detected";

export interface ConceptAssignment {
  concept_id: string;
  canonical_name: string;
  role: ConceptRole;
  confidence: number;
}

export interface HighlightEvidence {
  concept_id: string;
  field: "question" | "option" | "explanation";
  option_index?: number;
  exact_text: string;
}

export interface ConceptEntity {
  entity_id: string;
  name: string;
  entity_type: string;
}

export interface ConceptRelationship {
  subject_entity_id: string;
  relationship_type: string;
  object_entity_id: string | null;
  role: "tested_relationship" | "claimed_relationship" | "verified_relationship";
}

export interface ConceptProfile {
  primary_concepts: ConceptAssignment[];
  secondary_concepts: ConceptAssignment[];
  underlying_principle: string;
  knowledge_requirements: string[];
  entities: ConceptEntity[];
  relationships?: ConceptRelationship[];
}

export interface QuestionClassification {
  subject: string;
  topic: string;
  subtopics: string[];
  question_format: string;
  polarity: "positive_selection" | "negative_selection" | "mixed_or_conditional" | "not_applicable";
  reasoning_type: string[];
  question_intent: string;
  review?: {
    status: "supported" | "uncertain" | "conflict";
    taxonomy_policy?: "canonical_anchor" | "independent_source";
    primary_concept_id: string;
    subject_confidence: number;
    topic_confidence: number;
    rationale: string;
    source_evidence: HighlightEvidence[];
  };
}

export interface QuestionClaim {
  item_id: string;
  item_type: "statement" | "matching_pair" | "assertion" | "reason" | "option" | "other";
  normalized_meaning: string;
  concept_ids: string[];
  entities: string[];
  claimed_relationship: string;
  verified_relationship: string | null;
  truth_status: TruthStatus;
  verification_source: VerificationSource;
  correction_or_verified_fact: string | null;
  confidence: number;
}

export interface ProfileProvenance {
  inputs_used: ("question" | "options" | "provided_answer" | "provided_explanation")[];
  answer_status: AnswerStatus;
  truth_labels_based_on: string;
  needs_review: boolean;
  review_notes: string[];
}

export interface ProfileProcessing {
  status: "pending_extraction" | "extracting" | "pending_review" | "pending_embedding" | "embedding" | "ready" | "stale" | "failed";
  sourceContentHash: string | null;
  embeddingInputHash: string | null;
  promptVersion: string;
  taxonomyVersion: string;
  extractionModel: string | null;
  extractionContentHash?: string;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  embeddingSpaceVersion: string | null;
  updatedAt: string | null;
  error: string | null;
  maintenance?: StoredProfile["processing"]["maintenance"];
  subtopicMaintenance?: StoredProfile["processing"]["subtopicMaintenance"];
}

export interface QuestionConceptProfile extends QuestionReference {
  id: QuestionProfileId;
  schemaVersion: string;
  sourceMetadata: {
    exam: string | null;
    year: string | null;
    paper: string | null;
  };
  classification: QuestionClassification;
  concept_profile: ConceptProfile;
  claims: QuestionClaim[];
  concept_review?: ConceptReview;
  highlight_evidence?: HighlightEvidence[];
  similarity_profile: {
    concept_summary: string;
    matching_cautions: string[];
  };
  provenance: ProfileProvenance;
  concept_embedding_input: string;
  embedding: number[] | null;
  processing: ProfileProcessing;
  verification?: QuestionVerification;
}

export interface CanonicalConcept {
  id: string;
  canonical_name: string;
  definition: string;
  subject: string;
  topic: string;
  aliases: string[];
  parentConceptIds: string[];
  status: "provisional" | "active" | "retired";
  taxonomyVersion: string;
  retirement?: {
    replacementConceptId: string;
    retiredAt: string;
    reviewedBy: string;
    auditReference: string;
  };
}

export type SimilarityRelation =
  | "same_concept"
  | "related_concept"
  | "partial_concept_overlap"
  | "similar_question_pattern";

export interface SharedConcept {
  conceptId: string;
  canonicalName: string;
}

export interface SourceQualityNotice {
  code: string;
  reason: string;
}

export interface SimilarityMatch extends QuestionReference {
  profileId: QuestionProfileId;
  score: number;
  relation: SimilarityRelation;
  reasons: string[];
  sharedConcepts: SharedConcept[];
  allConcepts?: SharedConcept[];
  highlights?: HighlightEvidence[];
  question: SimilarityQuestionContent;
}

export interface SubjectClassificationDisplay {
  subjectId: string;
  subject: string;
}

interface SimilarityQuestionFields extends QuestionReference {
  id: string;
  question: string;
  exam: string;
  year: string;
  subject: string;
  subjectClassification?: SubjectClassificationDisplay | null;
  topic: string | null;
  subtopics?: string[];
  reviewWarnings?: SourceQualityNotice[];
}

export type SimilarityQuestionContent = SimilarityQuestionFields & (
  | { kind: "objective"; options: string[]; answer: string | null; explanation: string | null }
  | { kind: "descriptive"; paper: string | null; modelAnswer: string | null }
);

export interface SimilarityRequest extends QuestionReference {
  includePatternMatches?: boolean;
}

export type SimilarityResponse =
  | {
      status: "ready";
      source: QuestionReference;
      rankingVersion: string;
      sourceHighlights?: HighlightEvidence[];
      sourceSubtopics?: string[];
      sourceConcepts?: SharedConcept[];
      sourceWarnings?: SourceQualityNotice[];
      matches: SimilarityMatch[];
    }
  | {
      status: "pending" | "stale" | "failed";
      source: QuestionReference;
      message: string;
      matches: [];
    };
