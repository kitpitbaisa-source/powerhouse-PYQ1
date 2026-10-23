import React, { useId, useMemo, useState } from "react";
import { QuestionReviewPanel } from "./QuestionReviewPanel";
import { filterReviewQuestions, type CorrectionDraft, type ReviewFilter, type ReviewProgressFilter, type ReviewQuestion } from "./question-review";

export const QuestionReviewQueue: React.FC<{
  reviews: ReviewQuestion[] | null;
  adminKey: string;
  loading: boolean;
  error: string;
  onReload: () => void;
  onUnlock: () => void;
  onSaved?: (sourceContainer: string, questionId: string, draft: CorrectionDraft) => void;
  renderText?: (text: string, search: string) => React.ReactNode;
}> = ({ reviews, adminKey, loading, error, onReload, onUnlock, onSaved, renderText = (text, _search) => text }) => {
  const id = useId();
  const [search, setSearch] = useState("");
  const [check, setCheck] = useState<ReviewFilter>("either");
  const [progress, setProgress] = useState<ReviewProgressFilter>("all");
  const [visible, setVisible] = useState(50);
  const filtered = useMemo(() => filterReviewQuestions(reviews ?? [], search, check, progress), [reviews, search, check, progress]);
  const fieldClass = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800";
  return (
    <section aria-label="Flagged questions" className="w-full min-w-0 space-y-4">
      <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <h2 className="text-lg font-bold">Flagged questions</h2>
        <p className="text-sm">Temporary admin review view. All pending answer or explanation checks across Prelims, State PCS, CSAT, English, Mains and Essay. Other review flags are excluded.</p>
        {!adminKey ? (
          <div className="space-y-2">
            <p>Unlock the admin portal to load all affected questions and save correction drafts.</p>
            <button type="button" onClick={onUnlock} className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-bold text-white">Unlock admin portal</button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_15rem_11rem_auto]">
              <div>
                <label htmlFor={`${id}-search`} className="mb-1 block text-xs font-semibold">Search all flagged questions</label>
                <input id={`${id}-search`} type="search" value={search}
                  onChange={event => { setSearch(event.target.value); setVisible(50); }}
                  placeholder="Question, ID, exam, topic or issue reason" className={fieldClass} />
              </div>
              <div>
                <label htmlFor={`${id}-progress`} className="mb-1 block text-xs font-semibold">UI review status</label>
                <select id={`${id}-progress`} value={progress}
                  onChange={event => { setProgress(event.target.value as ReviewProgressFilter); setVisible(50); }} className={fieldClass}>
                  <option value="all">All</option>
                  <option value="not_reviewed">Not reviewed</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-check`} className="mb-1 block text-xs font-semibold">Review check</label>
                <select id={`${id}-check`} value={check} onChange={event => { setCheck(event.target.value as ReviewFilter); setVisible(50); }} className={fieldClass}>
                  <option value="either">Answer or explanation review</option>
                  <option value="answer">Answer review</option>
                  <option value="explanation">Explanation review</option>
                </select>
              </div>
              <button type="button" onClick={onReload} disabled={loading} className="self-end rounded-lg bg-amber-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {loading ? "Loading..." : "Refresh flags"}
              </button>
            </div>
            <p role="status" className="text-sm">{loading ? "Loading current review flags..." :
              `${filtered.length} matching flagged questions of ${reviews?.length ?? 0} across all banks. Showing ${Math.min(visible, filtered.length)}.`}</p>
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          </>
        )}
      </div>
      {adminKey && !loading && !error && reviews !== null && (
        <>
          {!filtered.length && <p className="p-4 text-sm">No flagged questions match this search and review check.</p>}
          {filtered.slice(0, visible).map(review => (
            <article key={`${review.sourceContainer}:${review.questionId}:${review.sourceContentHash}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                {review.sourceContainer} · Q#{review.questionId} · {[review.question.exam, review.question.year, review.question.subject, review.question.topic].filter(Boolean).join(" / ")}
              </h3>
              <div className="whitespace-pre-wrap text-sm">{renderText(review.question.question, search)}</div>
              {!!review.question.options.length && <ul className="mt-3 space-y-1 text-sm">
                {review.question.options.map((option, index) => <li key={index}>{renderText(option, search)}</li>)}
              </ul>}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">Current answer and explanation</summary>
                <div className="mt-2 whitespace-pre-wrap">{renderText(review.question.answer ?? "", search)}</div>
                <div className="mt-2 whitespace-pre-wrap">{renderText(review.question.explanation ?? "", search)}</div>
              </details>
              <QuestionReviewPanel sourceContainer={review.sourceContainer} questionId={review.questionId}
                access={{ key: adminKey, issues: review.issues, uiReview: review.uiReview, searchQuestion: review.question,
                  onSaved: draft => onSaved?.(review.sourceContainer, review.questionId, draft) }} />
            </article>
          ))}
          {visible < filtered.length && <button type="button" onClick={() => setVisible(count => count + 50)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Show 50 more flagged questions</button>}
        </>
      )}
    </section>
  );
};
