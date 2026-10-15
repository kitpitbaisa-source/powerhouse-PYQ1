<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/666e319f-be05-454b-9892-4be6e24bdca1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Concept and embedding pipeline

This server-only pipeline reads the existing question containers and writes
`question_concept_profiles` and the shared `concepts` dictionary. It does not
modify source questions. The similarity popup reads these profiles through
`GET /api/similarity`.

Set `COSMOS_ENDPOINT`, `COSMOS_KEY`, `SIMILARITY_GEMINI_API_KEY`, and
`SIMILARITY_EXTRACTION_MODEL` in `.env`. The extraction model must support
JSON Schema structured output. Use the dedicated similarity key, not
`GEMINI_API_KEY`, which the existing Vite configuration exposes to frontend
code. Never put confidential/user data in question content submitted to Gemini.

Embeddings use `gemini-embedding-2`, defaulting to 1536 dimensions. Configure
`SIMILARITY_EMBEDDING_DIMENSIONS` before creating the profile container.
Its vector index is `quantizedFlat` at `/embedding`, with cosine distance and
`/id` as the partition key. Existing incompatible policies are rejected,
not overwritten. Enable vector search on the Cosmos account before setup.
Vector indexing cannot use shared database throughput. When the database has
shared throughput, explicitly provision a dedicated profile-container allocation
with `--create --profile-throughput 400`. This can incur additional Azure charges.
The flag only applies to a new profile container and verifies its offer; it never
changes existing container or database throughput. The `concepts` container can
continue using shared database throughput.

```powershell
# Explicitly create the two containers; omit --create for validation only.
npm run similarity:setup -- --create

# Dedicated manual profile throughput; explicitly authorizes this allocation.
npm run similarity:setup -- --create --profile-throughput 400

# Preview only: no AI calls or database writes.
npm run similarity:process -- --source questions --limit 10

# Explicitly process one question.
npm run similarity:process -- --source questions --id 2262 --process

# Process up to 10 changed/missing profiles; rerun to resume.
npm run similarity:process -- --source questions --limit 10 --process
```

Supported sources: `questions`, `state_pcs`, `mains-questions`,
`essay-questions`, `csat-questions`, and `english-questions`.

### Agent extraction with Gemini embeddings only

`similarity:import` accepts JSON authored by an agent rather than calling a
text-generation API. The file has `formatVersion: "1"`, an `extractionModel`
label (for example `gpt-6.1-sol`), and `entries`. Each entry contains
`sourceContainer`, `questionId`, the SHA-256 `sourceContentHash` of the normalized
source question, and a complete `extractionResponseSchema` JSON object under
`extraction`. Extraction includes canonical `concept_definitions` and accurate
supplied-evidence provenance; agent reasoning is not independent verification.
Read the explanation together with the question and options when authoring
extractions. Capture mechanisms and prerequisites needed to solve the question,
including concepts left implicit in the stem, but omit incidental explanation
facts and answer-selection tricks. Preserve source conflicts as review flags;
do not treat a supplied explanation as independent factual verification.

Every newly authored extraction must include `highlight_evidence`, extracted
alongside its concepts rather than deferred until similarity matching. Review
the stem, every option, and the supplied explanation for important phrases
that name or describe each materially tested primary or supporting concept,
including relevant mechanisms, contrasts, and distractors. Include this evidence
even when the concept is not shared with another question; do not restrict it to
the correct option or an exact canonical-name match.

Each evidence entry contains `concept_id`, `field`
(`question`, `option`, or `explanation`), and `exact_text`. Option evidence also
requires a zero-based `option_index`; other fields must omit it. These are short,
verbatim source excerpts, not HTML or correctness labels. Validation rejects
unknown concept IDs, missing phrases, invalid option indices, and duplicate
entries. Keep phrases within a single renderable text segment, without spanning
HTML tags. Reuse a canonical ID across questions only for the same meaning and
scope, but preserve each question's own source wording rather than forcing
identical highlight text. Check every assigned concept for available literal
evidence; when none exists, leave that concept unhighlighted and document the
gap in `provenance.review_notes`. Generic statement-code options need no forced
highlight. Use an empty evidence array only when no suitable source phrase exists.
Existing profiles without this optional schema field remain compatible.
Imports that only change highlight metadata reuse an existing ready vector when
the source, embedding input, model, dimensions, and embedding space are unchanged.

```powershell
# Validate the entire file and source hashes without AI calls or writes.
npm run similarity:import -- --file "C:\path\extractions.json"

# Generate Gemini embeddings and save source-linked profiles.
npm run similarity:import -- --file "C:\path\extractions.json" --process
```

This path needs the dedicated Gemini key but not `SIMILARITY_EXTRACTION_MODEL`.
It never calls `generateContent`. Runtime validation, canonical resolution,
source-hash checks, leases, and optimistic writes remain in effect. Imported
extraction hashes make changed annotations invalidate old results. Failed
embeddings resume from saved extraction when the artifact is unchanged.

The processor validates extraction JSON, resolves canonical concepts by ID or
exact names/aliases, creates new concepts as provisional, and preserves false
claims separately from supplied evidence. It generates one focused embedding
and records content/input hashes and model/prompt/taxonomy versions.
`needs_review` remains independent of successful embedding generation.

Unchanged ready profiles are skipped. Failed embedding generation reuses the
saved extraction on retry. Source changes during processing invalidate the
result instead of publishing a stale vector. Optimistic writes and a
15-minute processing lease prevent overlapping runs from replacing each
other's results. Transient AI errors receive bounded retries; failures are
recorded and the command exits unsuccessfully.

Use `--force --process` to re-extract deliberately. Changed extraction models,
prompt versions, or taxonomy versions trigger re-extraction; changed embedding
spaces trigger re-embedding. Changing dimensions requires a compatible profile
container; this command never migrates or deletes existing containers.

The popup makes one request per source question during each opening, including
under React StrictMode. Results are ordered by cosine ranking score (0-100,
not a probability). Original question content comes from the source containers;
shared-concept reasons come from the profiles. Profiles and vectors never reach
the browser. Missing/unready or changed profiles return an empty `matches` array;
the right pane shows an empty state. API failures show an error, never keyword
fallback results.

Search retrieves at most 50 compatible candidates and returns up to 12 current,
active questions. Prelims searches both `questions` and `state_pcs`; other popup
banks search their own container. Nonsubscribers are restricted to each bank's
latest two years, following the existing email/status access convention.
Search is read-only: it never creates profiles or calls Gemini on click.

Run the batch command externally for now. Automatic import/change-feed triggers
and persistent recommendation caching are not enabled.
