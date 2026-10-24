import type { SimilarityResponse } from "./types.js";

// Second cache layer behind the CDN: Vercel's regional Runtime Cache. Misses fall through to Cosmos.
const ttlSeconds = 60 * 60 * 24 * 30;

type RuntimeCache = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options?: { ttl?: number; tags?: string[] }): Promise<void>;
  expireTag(tag: string | string[]): Promise<void>;
};

async function runtimeCache(): Promise<RuntimeCache | undefined> {
  if (!process.env.VERCEL) return undefined;
  const { getCache } = await import("@vercel/functions");
  return getCache() as RuntimeCache;
}

export const similarityRuntimeKey = (sourceContainer: string, questionId: string, tier: string) =>
  `similarity:v1:${sourceContainer}:${questionId}:${tier}`;

// Cache failures must never break a search, so every operation degrades to a miss.
export async function readRuntimeSimilarity(key: string): Promise<SimilarityResponse | undefined> {
  try {
    const value = await (await runtimeCache())?.get(key);
    return value && typeof value === "object" ? value as SimilarityResponse : undefined;
  } catch (error) {
    console.warn("Runtime cache read failed:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

export async function writeRuntimeSimilarity(key: string, value: SimilarityResponse, tags: string[]): Promise<void> {
  try {
    await (await runtimeCache())?.set(key, value, { ttl: ttlSeconds, tags });
  } catch (error) {
    console.warn("Runtime cache write failed:", error instanceof Error ? error.message : error);
  }
}

export async function expireRuntimeTags(tags: string[]): Promise<void> {
  await (await runtimeCache())?.expireTag(tags);
}
