import type { Database } from "@azure/cosmos";
import { waitUntil } from "@vercel/functions";
import type { SimilarityResponse } from "./types.js";

export const similarityResultsContainerId = "similarity_results";

export interface StoredSimilarityResult {
  id: string;
  rankingVersion: string;
  tags: string[];
  createdAt: string;
  result: SimilarityResponse;
}

// Durable store of finished similarity results. Failures degrade to a miss so a search never breaks.
export function createSimilarityResultStore(database: Database) {
  const container = () => database.container(similarityResultsContainerId);
  return {
    async read(id: string, rankingVersion: string): Promise<SimilarityResponse | undefined> {
      try {
        const { resource } = await container().item(id, id).read<StoredSimilarityResult>();
        return resource?.rankingVersion === rankingVersion && resource.result.status === "ready" ? resource.result : undefined;
      } catch (error) {
        console.warn("Similarity result read failed:", error instanceof Error ? error.message : error);
        return undefined;
      }
    },
    async write(entry: StoredSimilarityResult): Promise<void> {
      try {
        await container().items.upsert(entry);
      } catch (error) {
        console.warn("Similarity result write failed:", error instanceof Error ? error.message : error);
      }
    },
    // Deletes every stored result carrying any of the tags; returns how many were removed.
    async purge(tags: string[]): Promise<number> {
      const { resources } = await container().items.query<string>({
        query: "SELECT VALUE c.id FROM c WHERE EXISTS(SELECT VALUE t FROM t IN c.tags WHERE ARRAY_CONTAINS(@tags, t))",
        parameters: [{ name: "@tags", value: tags }],
      }).fetchAll();
      for (let offset = 0; offset < resources.length; offset += 20) {
        await Promise.all(resources.slice(offset, offset + 20).map(id => container().item(id, id).delete().catch(error => {
          if (error?.code !== 404) throw error;
        })));
      }
      return resources.length;
    },
  };
}

// Lets the response go out first on Vercel; the write finishes in the background.
export function runAfterResponse(task: Promise<unknown>): Promise<unknown> | void {
  if (process.env.VERCEL) {
    waitUntil(task);
    return;
  }
  return task;
}
