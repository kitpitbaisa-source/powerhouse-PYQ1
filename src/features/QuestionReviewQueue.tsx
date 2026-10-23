import React, { useId, useMemo, useState } from "react";
import { Calendar, CheckCircle2, FileText } from "lucide-react";
import { QuestionReviewPanel } from "./QuestionReviewPanel";
import { filterReviewQuestions, type CorrectionDraft, type ReviewFilter, type ReviewProgressFilter, type ReviewQuestion } from "./question-review";

const bankNames = {
  questions: "Prelims", state_pcs: "State PCS", "csat-questions": "CSAT",
  "english-questions": "English", "mains-questions": "Mains", "essay-questions": "Essay",
};

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
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-bold">Flagged questions</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Find questions with answer or explanation issues, review the evidence, and save your corrections.</p>
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
                <label htmlFor={`${id}-progress`} className="mb-1 block text-xs font-semibold">Review status</label>
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
              <button type="button" onClick={onReload} disabled={loading} className="self-end rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
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
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {filtered.slice(0, visible).map(review => {
              const reviewed = review.uiReview?.status === "reviewed";
              const badgeClass = "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600/70";
              return (
                <article key={`${review.sourceContainer}:${review.questionId}:${review.sourceContentHash}`}
                  data-review-status={reviewed ? "reviewed" : "not_reviewed"}
                  className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors sm:p-5 ${
                    reviewed ? "border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/30 dark:ring-emerald-900"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/70"}`}>
                  <div className={`absolute inset-x-0 top-0 h-1 ${reviewed ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <header className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={badgeClass}><FileText className="h-3 w-3" />{review.question.exam || bankNames[review.sourceContainer]}</span>
                      <div className="flex items-center gap-2">
                        {review.question.year && <span className={badgeClass}><Calendar className="h-3 w-3" />{review.question.year}</span>}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          reviewed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
                          {reviewed && <CheckCircle2 className="h-3 w-3" />}{reviewed ? "Reviewed" : "Needs review"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {review.question.subject && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">{review.question.subject}</span>}
                      {review.question.topic && <span className={badgeClass}>{review.question.topic}</span>}
                      <span className="ml-auto text-[10px] font-medium text-slate-500 dark:text-slate-400">{bankNames[review.sourceContainer]} · Q#{review.questionId}</span>
                    </div>
                  </header>
                  <div className="mb-4 px-1 text-[13.5px] font-medium leading-[23px] text-slate-900 dark:text-slate-100">{renderText(review.question.question, search)}</div>
                  {!!review.question.options.length && <ul aria-label="Question options" className="mb-4 space-y-2 px-1">
                    {review.question.options.map((option, index) => <li key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[13px] font-medium leading-[19px] dark:border-slate-600/70 dark:bg-slate-900/30">{renderText(option, search)}</li>)}
                  </ul>}
                  <details className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[13px] leading-relaxed dark:border-blue-900/50 dark:bg-blue-950/20">
                    <summary className="cursor-pointer font-semibold text-blue-700 dark:text-blue-300">Current answer and explanation</summary>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Stored answer</p>
                    <div className="mt-1 whitespace-pre-wrap">{renderText(review.question.answer ?? "", search)}</div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Explanation</p>
                    <div className="mt-1 whitespace-pre-wrap">{renderText(review.question.explanation ?? "", search)}</div>
                  </details>
                  <QuestionReviewPanel sourceContainer={review.sourceContainer} questionId={review.questionId}
                    access={{ key: adminKey, issues: review.issues, uiReview: review.uiReview, searchQuestion: review.question,
                      onSaved: draft => onSaved?.(review.sourceContainer, review.questionId, draft) }} />
                </article>
              );
            })}
          </div>
          {visible < filtered.length && <button type="button" onClick={() => setVisible(count => count + 50)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Show 50 more flagged questions</button>}
        </>
      )}
    </section>
  );
};
