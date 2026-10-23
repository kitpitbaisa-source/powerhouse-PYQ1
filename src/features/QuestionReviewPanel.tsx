import React, { useId, useState } from "react";
import type { QuestionSourceContainer } from "../../features/similarity/types";
import { pendingContentIssues, reviewSearchUrl, reviewStateForDraft, type ContentVerification, type ContentReviewIssue,
  type CorrectionDraft, type QuestionReviewDetails, type ReviewSearchQuestion, type UiReviewStatus } from "./question-review";

export type AdminReviewAccess = {
  key: string;
  issues?: ContentReviewIssue[];
  uiReview?: UiReviewStatus;
  sourceContentHash?: string;
  searchQuestion?: ReviewSearchQuestion;
  onSaved?: (draft: CorrectionDraft) => void;
};

export const QuestionReviewPanel: React.FC<{
  sourceContainer: QuestionSourceContainer;
  questionId: string | number;
  verification?: ContentVerification;
  access?: AdminReviewAccess;
}> = ({ sourceContainer, questionId, verification, access }) => {
  const id = useId();
  const [details, setDetails] = useState<QuestionReviewDetails | null>(null);
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const issues = details?.issues ?? access?.issues ?? pendingContentIssues(verification);
  if (!access || !issues.length) return null;
  const reviewStatus = details ? reviewStateForDraft(details.draft, details.sourceContentHash) : access.uiReview;
  const options = details?.original.options ?? [];
  const searchQuestion = details?.original ?? access.searchQuestion;
  const endpoint = `/api/admin/question-review/${encodeURIComponent(sourceContainer)}/${encodeURIComponent(String(questionId))}`;
  const fieldClass = "w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 dark:border-amber-700 dark:bg-slate-800 dark:text-white";
  const notify = (text: string, failed = false) => { setMessage(text); setError(failed); };
  const load = async () => {
    setBusy(true); notify("");
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${access.key}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the review.");
      const loaded: QuestionReviewDetails = data;
      setDetails(loaded);
      const currentDraft = loaded.staleDraft ? null : loaded.draft;
      setAnswer(currentDraft?.answer ?? loaded.original.answer);
      setExplanation(currentDraft?.explanation ?? loaded.original.explanation);
      setComment(currentDraft?.comment ?? "");
      if (loaded.staleDraft) notify("The earlier draft belongs to a different source version. Review the current text before saving a new revision.");
      else if (loaded.draft) notify(`Loaded saved draft revision ${loaded.draft.revision}.`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not load the review.", true); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!details) return;
    setBusy(true); notify("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access.key}` },
        body: JSON.stringify({ sourceContentHash: details.sourceContentHash,
          expectedRevision: details.draft?.revision ?? 0, answer, explanation, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Draft save was not confirmed.");
      setDetails({ ...details, draft: data.draft, staleDraft: false });
      access.onSaved?.(data.draft);
      notify(`Draft revision ${data.draft.revision} saved online. Marked Reviewed in this UI. Live content and review flags are unchanged.`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Draft save was not confirmed.", true); }
    finally { setBusy(false); }
  };
  return (
    <section aria-label="Answer and explanation review" className="my-3 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/30">
      <h4 className="font-bold text-amber-900 dark:text-amber-200">
        {reviewStatus?.status === "reviewed" ? "UI review completed · Admin only" : "Needs answer/explanation review · Admin only"}
      </h4>
      {reviewStatus?.status === "reviewed" && <p aria-label="Reviewed in this UI" className="font-bold text-green-800 dark:text-green-300">
        Reviewed in this UI · {new Date(reviewStatus.reviewedAt).toLocaleString()}
      </p>}
      <p className="text-amber-800 dark:text-amber-300">Temporary correction drafts only. Reviewed means a draft was saved here; live verification flags remain unchanged.</p>
      {issues.map(issue => (
        <div key={`${issue.check}:${issue.code}:${issue.reason}`}>
          <details className="text-amber-900 dark:text-amber-200">
            <summary className="cursor-pointer">
              <code className="break-all font-semibold">{issue.code}</code>
              <span className="block">{issue.reason.length <= 160 ? issue.reason : `${issue.reason.slice(0, 157)}...`}</span>
            </summary>
            <p className="mt-1 whitespace-pre-wrap">{issue.reason}</p>
            {issue.requiredAction && <p className="mt-1">Required: {issue.requiredAction}</p>}
          </details>
          {searchQuestion && <a href={reviewSearchUrl(searchQuestion, issue)} target="_blank" rel="noopener noreferrer"
            referrerPolicy="no-referrer" className="mt-1 inline-block font-semibold text-blue-700 underline dark:text-blue-300">
            Google: question + exam + reason
          </a>}
        </div>
      ))}
      {!access.key ? <p>Unlock the admin portal to load and save online correction drafts.</p> : (
        <button type="button" disabled={busy} onClick={load} className="font-semibold text-blue-700 disabled:opacity-50 dark:text-blue-300">
          {busy ? "Please wait..." : details ? "Reload saved draft" : "Review / edit correction draft"}
        </button>
      )}
      {details && (
        <form onSubmit={save} className="space-y-2">
          <label htmlFor={`${id}-answer`} className="block font-semibold">Proposed answer</label>
          {options.length ? (
            <select id={`${id}-answer`} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} className={fieldClass}>
              <option value="">No answer selected / unresolved</option>
              {answer && !options.includes(answer) && <option value={answer}>Current/saved answer: {answer.replace(/<[^>]*>/g, " ")}</option>}
              {options.map((option, index) => <option key={index} value={option}>{option.replace(/<[^>]*>/g, " ")}</option>)}
            </select>
          ) : (
            <textarea id={`${id}-answer`} value={answer} onChange={event => setAnswer(event.target.value)} rows={3} maxLength={20000} disabled={busy} className={fieldClass} />
          )}
          <label htmlFor={`${id}-explanation`} className="block font-semibold">Proposed explanation</label>
          <textarea id={`${id}-explanation`} value={explanation} onChange={event => setExplanation(event.target.value)} rows={6} required maxLength={100000} disabled={busy} className={fieldClass} />
          <label htmlFor={`${id}-comment`} className="block font-semibold">Reason / supporting reference</label>
          <textarea id={`${id}-comment`} value={comment} onChange={event => setComment(event.target.value)} rows={2} required maxLength={4000} disabled={busy} className={fieldClass} />
          <button type="submit" disabled={busy || !access.key || !explanation.trim() || !comment.trim()} className="rounded-lg bg-amber-800 px-3 py-2 font-bold text-white disabled:opacity-50">
            {busy ? "Saving..." : "Save draft online"}
          </button>
          {details.draft && <p>Saved revision {details.draft.revision} · {details.draft.savedAt}</p>}
        </form>
      )}
      {message && <p role={error ? "alert" : "status"} className={error ? "text-red-700 dark:text-red-300" : "text-amber-900 dark:text-amber-200"}>{message}</p>}
    </section>
  );
};
