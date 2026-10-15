import "dotenv/config";
import { parseArgs } from "node:util";
import { readDimensions } from "../../features/similarity/config";
import { createRepository, ensureContainers } from "../../features/similarity/repository";

async function main() {
  const { values } = parseArgs({
    options: {
      create: { type: "boolean", default: false },
      "profile-throughput": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(`npm run similarity:setup -- [--create] [--profile-throughput RU_PER_SECOND]
Without --create, validates existing containers only.
--profile-throughput explicitly provisions dedicated manual throughput for a new profile container.
It requires --create, can incur additional charges, and never changes existing throughput.`);
    return;
  }
  const throughputValue = values["profile-throughput"];
  if (throughputValue !== undefined && !/^[1-9]\d*$/.test(throughputValue)) {
    throw new Error("--profile-throughput must be an integer number of RU/s.");
  }
  const profileThroughput = throughputValue === undefined ? undefined : Number(throughputValue);
  const repository = createRepository();
  await ensureContainers(repository.database, readDimensions(), values.create, profileThroughput);
  console.log("question_concept_profiles and concepts are configured: /id partition, cosine, quantizedFlat.");
  if (profileThroughput !== undefined) console.log(`Profile container dedicated throughput: ${profileThroughput} RU/s.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Similarity container setup failed.");
  process.exitCode = 1;
});
