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

### Master subtopic IDs

`subject_topic_master` supports separate subtopic records without changing existing
subject/topic IDs, parent mappings, or legacy topic `details`. For example,
`S12` (Science) contains `S12-T01` (Physics), whose subtopics use stable IDs such
as `S12-T01-ST01`. A subtopic has `type: "subtopic"`, `parentId: "S12-T01"`,
and `subjectId: "S12"` (the existing partition key). Never renumber or reuse IDs.

Catalogue files may add `subtopicRecords: [{ id, name, details? }]` to a topic;
the existing `subtopics: string[]` continues to populate legacy `details`.
Use the master revision command with a backup when extending a live catalogue.
Existing subject/topic records need not change when adding child records.

An extraction may include `classification.master` with `subjectId`, `topicId`,
and `subtopicIds`. Its `classification.subtopics` contains the corresponding
exact names in the same order. The pipeline checks that the IDs and names belong
to active records in that hierarchy before creating concepts or embedding,
including when reusing a ready profile. Mismatches are held as `pending_review`.
Legacy extractions without these references remain compatible. These references
do not rewrite source labels or make an unverified question fully verified.

Subtopics are classification, card-display and filtering metadata only. Their
names, IDs and hierarchy paths are excluded from embedding text and its hash.
The existing subject/topic labels and reviewed concept content remain the
embedding inputs; a subtopic label must not be copied into concept fields merely
to influence similarity. Actual tested concepts can still use the same words
as a category. Subtopic-only metadata changes do not require a new embedding
space or a global vector regeneration. Changing this policy requires explicit
approval. The online processing CLI loads the active master and requires
master-backed classification in its extraction schema.

This server-only pipeline reads the existing question containers and writes
`question_concept_profiles` and the shared `concepts` dictionary. It also patches
source questions' verification metadata; it does not change their wording,
answers, explanations, or subject/topic labels. The similarity popup reads profiles through
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

The processor validates extraction JSON, requires a source-grounded semantic
identity/role and coverage review, and uses exact ID/name/definition checks as
additional conflict guards, not as proof of equivalent meaning. Approved new
concepts are provisional. False claims remain separate from supplied evidence.
It generates one focused embedding
and records content/input hashes and model/prompt/taxonomy versions.
`needs_review` remains independent of successful embedding generation.

### Canonical identity and coverage gates

New processing enforces these five safeguards on both generated and imported
extractions:

1. `concept_review.coverage` inventories every materially tested fact and
   supporting principle, links each to assigned concepts and literal evidence,
   and accounts for every individual claim. `reviewed_fields` accounts for the
   stem, each option, and any supplied explanation exactly once. Use one concept
   for a genuinely single-concept question, or several when required; never pad
   the inventory. An omitted item must appear in `uncovered_items` with status
   `uncertain`, rather than approving an umbrella concept.
2. Each identity/role decision includes `compared_concept_ids`, source evidence,
   and meaning/scope and role rationales. Equivalent meanings reuse one ID even
   across paraphrases, compound questions, or different roles. Broad/narrow
   meanings remain distinct. Final semantic comparison is performed by the
   identified model/agent/reviewer, not inferred mechanically from strings or
   cosine similarity.
3. Offline parallel workers must reconcile their full proposals before import.
   Add top-level `registry_review` with `reviewed_by`, ISO `reviewed_at`,
   `registry_fingerprint`, and `proposals_fingerprint`. The latter binds every
   entry, including its source hash, coverage, decisions, and verification.
   Use `registryFingerprint` and `batchProposalsFingerprint` from
   `features\similarity\concept-review.ts` **after** reviewing the live registry
   and all workers' meanings together. Remap all assignments, claims, evidence,
   and definitions to the chosen IDs before binding the final batch. A shared
   concept absent from the reviewed baseline uses one consistent new ID and
   definition in every entry; it is created only once.
4. A Cosmos-backed global coordinator serializes final review and canonical
   admission across cooperating pipeline processes. Normal extraction refreshes
   the registry and runs its final semantic review after acquiring ownership.
   Reviewed offline batches keep ownership throughout processing; their own
   exact, approved canonical publications can be recognized on resume, but
   unrelated registry changes invalidate the review. No new container or
   throughput provisioning is required. Direct Cosmos canonical writes bypass
   this protocol and must not be used by workers.
5. Missing, stale, incomplete, or uncertain review produces a durable
   `pending_review` source/profile flag and no concept creation or vector for
   that question. Batch processing continues and reports the affected IDs.
   Resolving an existing flag still requires an identified, evidence-backed
   entry-level verification review; `--force` does not clear it.

Single-entry imports may instead carry `concept_review.audit`, bound using
`bindConceptReview(question, extraction, registry, reviewer, review)` after a
real source-grounded review. It records the reviewer/date, source/proposal
hashes, and registry fingerprint. Online processing binds the actual model
review in the same way. Receipt helpers record a review; computing a fingerprint
does **not** perform or prove semantic review. Imports remain embedding-only.
Older stored profiles remain readable; processing them again requires the new
coverage/admission metadata. Changed annotations require a new review binding.

The coordinator uses reserved `concepts/__concept_registry_coordinator__`,
excluded from canonical queries. Its ownership deliberately does not expire:
an expired lease could let a delayed old write race a new writer. A crashed
writer or unconfirmed canonical write therefore blocks later writers instead
of risking duplicates. The lock records its owner and current proposed write.
Before recovery, stop the owning writer, settle any in-flight write, inspect
and reconcile that proposal against persisted canonicals, and obtain a fresh
semantic review if necessary. Only then explicitly release that exact owner:

```powershell
npm run similarity:setup -- --release-concept-lock OWNER_UUID
```

Never release a live writer's lock. Normal completion and review failures
release ownership with an ETag condition; uncertain canonical writes retain it.
Coordinator contention is a retryable processing failure, not evidence that
the source question is factually incorrect.

### Consistent question verification flags

All six banks store canonical `verification` metadata on the question itself,
with the same metadata mirrored in its shared concept profile. `verification.status` is
`unverified`, `verified`, or `pending_review`. This is separate from
`processing.status`: a ready embedding does not mean that its answer or
explanation has been independently verified. Legacy profiles without verification
metadata are unverified; they are not automatically backfilled as verified.

Each verification record includes a readable `reason` and tracks the normalized source hash, update time,
reviewer, five checks (`question`, `answer`, `explanation`,
`master_classification` (subject/topic), and `concepts`), blocking issues, and correction audit
references. Each issue includes a stable code, affected check, reason, evidence,
and required action. Corrections record the changed field, reason, and reference
to the source-change backup, rather than implying every verified item needed edits.

A reviewed import may include an optional `verification` object alongside
`extraction`. Full `verified` status requires an identified reviewer, evidence for
all five passed checks, source and reviewed-extraction hashes, master subject/topic
IDs, and no unresolved issues or provenance warnings. The pipeline checks the
active master pair and compares its names with the source and extracted labels.
Review evidence must actually support the findings; supplying metadata does not
perform factual research or make an explanation an independent reference.

Blocking findings are saved as `pending_review`, with
`provenance.needs_review: true`, `embedding: null`, and
`processing.error: "REVIEW_FLAG[ISSUE_CODE]: reason"`. Flags are read back after
saving. The batch reports them and continues without publishing a vector.
Held review items do not consume the normal processing-attempt limit.
Neither `--force`, editing the source, nor reimporting unchecked metadata clears
an unresolved issue. Each check has its own `status`, `reason`, and evidence, so
the answer can remain pending review even after subject/topic verification passes.
A resolution requires a reviewed import with an identified
reviewer and evidence-backed passed checks for the blocked areas. Source or
extraction changes invalidate previous full verification while retaining
correction audit references.

Source updates patch only `/verification`, with document-version checks and
read-back verification. This field is deliberately excluded from the normalized
source-content hash, so updating a flag does not invalidate an otherwise unchanged
question. Similarity search also checks source flags, preventing an outdated
ready profile from bypassing a newly added question-level review block.

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
