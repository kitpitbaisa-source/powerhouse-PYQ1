import { Router } from "express";
import type { Database } from "@azure/cosmos";
import { z } from "zod";
import { sourceContainers } from "./similarity/config.js";
import { sourceQuestionSchema } from "./similarity/schema.js";
import { hashContent } from "./similarity/content-hash.js";
import { pendingContentIssues, reviewStateForDraft, type CorrectionVersion } from "../src/features/question-review.js";

const draftContainerId = "question-review-drafts";
const referenceSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().min(1).max(200),
});
const submissionSchema = z.object({
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedRevision: z.number().int().nonnegative(),
  answer: z.string().trim().max(20_000),
  explanation: z.string().trim().min(1).max(100_000),
  comment: z.string().trim().min(1).max(4_000),
}).strict();

function code(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  return "code" in error ? Number(error.code) : "statusCode" in error ? Number(error.statusCode) : undefined;
}

export function createQuestionReviewRouter(database: Database) {
  const router = Router();
  let ensureDrafts: Promise<unknown> | undefined;
  const read = async (container: string, id: string) => {
    try { return (await database.container(container).item(id, id).read()).resource; }
    catch (error) { if (code(error) === 404) return undefined; throw error; }
  };
  const current = async (sourceContainer: string, questionId: string) => {
    const raw = await read(sourceContainer, questionId);
    if (!raw || raw.isActive === false) return undefined;
    const source = sourceQuestionSchema.parse(raw);
    const sourceContentHash = hashContent(source);
    const profile = await read("question_concept_profiles", `${sourceContainer}:${questionId}`);
    const issues = [...pendingContentIssues(raw.verification),
      ...(profile?.processing?.sourceContentHash === sourceContentHash ? pendingContentIssues(profile.verification) : [])];
    return { raw, source, sourceContentHash,
      issues: [...new Map(issues.map(issue => [`${issue.check}:${issue.code}:${issue.reason}`, issue])).values()] };
  };
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/", async (_req, res) => {
    try {
      const pending = `c.verification.checks.answer.status = "pending_review" OR c.verification.checks.explanation.status = "pending_review"`;
      const { resources: profiles } = await database.container("question_concept_profiles").items.query(
        `SELECT c.sourceContainer,c.questionId,c.verification,c.processing FROM c WHERE ${pending}`,
      ).fetchAll();
      const { resources: drafts } = await database.container(draftContainerId).items.query(
        "SELECT c.id,c.sourceContentHash,c.revision,c.reviewedAt FROM c WHERE IS_DEFINED(c.reviewedAt)",
      ).fetchAll().catch(error => {
        if (code(error) === 404) return { resources: [] };
        throw error;
      });
      const draftsById = new Map(drafts.map(draft => [draft.id, draft]));
      const reviews = (await Promise.all(sourceContainers.map(async sourceContainer => {
        const candidates = profiles.filter(profile => profile.sourceContainer === sourceContainer);
        const byId = new Map(candidates.map(profile => [profile.questionId, profile]));
        const { resources } = await database.container(sourceContainer).items.query({
          query: `SELECT * FROM c WHERE ${pending} OR ARRAY_CONTAINS(@ids,c.id)`,
          parameters: [{ name: "@ids", value: candidates.map(profile => profile.questionId) }],
        }).fetchAll().catch(error => {
          if (code(error) === 404) return { resources: [] };
          throw error;
        });
        return resources.filter(raw => raw.isActive !== false).flatMap(raw => {
          const profile = byId.get(String(raw.id));
          const source = sourceQuestionSchema.parse(raw);
          const sourceContentHash = hashContent(source);
          const issues = [...pendingContentIssues(raw.verification),
            ...(profile?.processing?.sourceContentHash === sourceContentHash ? pendingContentIssues(profile.verification) : [])];
          const unique = [...new Map(issues.map(issue => [`${issue.check}:${issue.code}:${issue.reason}`, issue])).values()];
          return unique.length ? [{ sourceContainer, questionId: String(raw.id), question: source, sourceContentHash,
            issues: unique, uiReview: reviewStateForDraft(draftsById.get(`${sourceContainer}:${raw.id}`), sourceContentHash) }] : [];
        });
      }))).flat();
      res.json({ reviews });
    } catch (error) {
      console.error("Could not load answer/explanation review flags:", error);
      res.status(500).json({ error: "Could not load review flags. Try unlocking the admin portal again." });
    }
  });
  router.get("/:sourceContainer/:questionId", async (req, res) => {
    const reference = referenceSchema.safeParse(req.params);
    if (!reference.success) return res.status(400).json({ error: "Invalid question reference." });
    try {
      const { sourceContainer, questionId } = reference.data;
      const question = await current(sourceContainer, questionId);
      if (!question) return res.status(404).json({ error: "Active question not found." });
      const draft = await read(draftContainerId, `${sourceContainer}:${questionId}`);
      res.json({ sourceContentHash: question.sourceContentHash, issues: question.issues,
        original: { question: question.source.question, exam: question.source.exam, year: question.source.year,
          answer: question.source.answer ?? "", explanation: question.source.explanation ?? "", options: question.source.options },
        draft: draft ?? null, staleDraft: !!draft && draft.sourceContentHash !== question.sourceContentHash });
    } catch (error) {
      console.error("Could not load question correction draft:", error);
      res.status(500).json({ error: "Could not load the current question review. Try again." });
    }
  });
  router.put("/:sourceContainer/:questionId", async (req, res) => {
    const reference = referenceSchema.safeParse(req.params);
    const submission = submissionSchema.safeParse(req.body);
    if (!reference.success || !submission.success) {
      return res.status(400).json({ error: "Provide a current question version, corrected explanation and review comment." });
    }
    try {
      const { sourceContainer, questionId } = reference.data;
      const input = submission.data;
      const question = await current(sourceContainer, questionId);
      if (!question) return res.status(404).json({ error: "Active question not found." });
      if (!question.issues.length) return res.status(409).json({ error: "This question has no pending answer or explanation check." });
      if (question.sourceContentHash !== input.sourceContentHash) {
        return res.status(409).json({ error: "The live question changed. Reload the review before saving." });
      }
      const id = `${sourceContainer}:${questionId}`;
      const existing = await read(draftContainerId, id);
      if ((existing?.revision ?? 0) !== input.expectedRevision) {
        return res.status(409).json({ error: "Another administrator saved a newer draft. Reload before editing." });
      }
      const savedAt = new Date().toISOString();
      const version: CorrectionVersion = { revision: input.expectedRevision + 1,
        sourceContentHash: input.sourceContentHash, answer: input.answer, explanation: input.explanation,
        comment: input.comment, savedAt, reviewedAt: savedAt };
      const document = { id, sourceContainer, questionId, status: "draft", ...version,
        original: question.source, reviewIssues: question.issues,
        history: [...(existing?.history ?? []), version] };
      ensureDrafts ??= database.containers.createIfNotExists({
        id: draftContainerId, partitionKey: { paths: ["/id"] },
      }).catch(error => { ensureDrafts = undefined; throw error; });
      await ensureDrafts;
      const beforeSave = await read(sourceContainer, questionId);
      if (!beforeSave || beforeSave._etag !== question.raw._etag ||
          hashContent(sourceQuestionSchema.parse(beforeSave)) !== input.sourceContentHash) {
        return res.status(409).json({ error: "The live question changed during review. Reload before saving." });
      }
      const container = database.container(draftContainerId);
      if (existing) await container.item(id, id).replace(document, {
        accessCondition: { type: "IfMatch", condition: existing._etag },
      });
      else await container.items.create(document);
      const confirmed = await read(draftContainerId, id);
      if (!confirmed || hashContent(confirmed.history) !== hashContent(document.history) ||
          confirmed.revision !== version.revision || confirmed.explanation !== version.explanation ||
          confirmed.answer !== version.answer || confirmed.sourceContentHash !== version.sourceContentHash ||
          confirmed.reviewedAt !== version.reviewedAt) {
        throw new Error("Saved correction draft could not be confirmed by independent readback.");
      }
      res.json({ draft: confirmed, message: "Draft saved online. Live answer, explanation and review flags are unchanged." });
    } catch (error) {
      if ([409, 412].includes(code(error))) {
        return res.status(409).json({ error: "A newer draft was saved. Reload before editing." });
      }
      console.error("Could not save question correction draft:", error);
      res.status(500).json({ error: "Draft save was not confirmed. Reload to check the saved revision before retrying." });
    }
  });
  return router;
}
