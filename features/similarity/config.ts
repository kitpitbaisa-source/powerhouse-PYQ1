export const sourceContainers = [
  "questions", "state_pcs", "mains-questions", "essay-questions",
  "csat-questions", "english-questions",
] as const;

export const profileContainerId = "question_concept_profiles";
export const provisionalProfileContainerId = "question_concept_provisional_profiles";
export const conceptsContainerId = "concepts";
export const schemaVersion = "1.0";
export const promptVersion = "pyq-concepts-v3-identity-role-review";
export const classificationConfidenceThreshold = 0.85;
export const embeddingModel = "gemini-embedding-2";
export const embeddingPrefix = "task: sentence similarity | query: ";

export function readDimensions(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.SIMILARITY_EMBEDDING_DIMENSIONS ?? "1536");
  if (![768, 1536, 3072].includes(value)) {
    throw new Error("SIMILARITY_EMBEDDING_DIMENSIONS must be 768, 1536, or 3072.");
  }
  return value;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

export function readStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    endpoint: required(env, "COSMOS_ENDPOINT"),
    key: required(env, "COSMOS_KEY"),
    databaseId: "pyqpowerhouse",
  };
}

export function readEmbeddingConfig(env: NodeJS.ProcessEnv = process.env) {
  const dimensions = readDimensions(env);
  return {
    apiKey: required(env, "SIMILARITY_GEMINI_API_KEY"),
    dimensions,
    taxonomyVersion: env.SIMILARITY_TAXONOMY_VERSION?.trim() || "v1",
    embeddingSpaceVersion: `${embeddingModel}:${dimensions}:sentence-similarity:normalized:v1`,
  };
}

export function readPipelineConfig(env: NodeJS.ProcessEnv = process.env) {
  return { ...readEmbeddingConfig(env), extractionModel: required(env, "SIMILARITY_EXTRACTION_MODEL") };
}

export type EmbeddingConfig = ReturnType<typeof readEmbeddingConfig>;
export type PipelineConfig = ReturnType<typeof readPipelineConfig>;
