import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, ChevronLeft, ChevronRight, Crown, Flame, RefreshCw, Target, Trophy, X } from "lucide-react";
import type { LeaderboardEntry, LeaderboardHighlights } from "../../features/statistics/router";

interface ResponseData {
  entries: LeaderboardEntry[];
  total: number;
  realTotal?: number;
  pageSize: number;
  exams: string[];
  me: LeaderboardEntry | null;
  updatedAt: string | null;
  pendingUpdates: boolean;
  highlights: LeaderboardHighlights;
}

export function CurrentStreakBadge({ currentStreak, onClick, signedIn = true }: { currentStreak: number | null; onClick: () => void; signedIn?: boolean }) {
  const label = currentStreak === null
    ? "Current streak unavailable. Open leaderboard."
    : `Current streak: ${currentStreak} consecutive correct answers across all exams. ${signedIn ? "" : "This visit only; resets on refresh. "}Open leaderboard.`;
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="relative isolate flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-orange-400 bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600       text-white transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-slate-800">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0.5 top-0.5 h-2.5 rounded-t-md bg-gradient-to-b from-white/30 to-transparent" />
            <Flame aria-hidden="true" className="relative h-4 w-4 fill-amber-100 text-amber-50" />
      <span className="absolute -right-1.5 -top-1.5 min-w-[15px] rounded-full border border-orange-200 bg-white px-1 text-[9px] font-black leading-[15px] tabular-nums text-orange-700">{currentStreak ?? "-"}</span>
    </button>
  );
}

type RankingMetric = keyof LeaderboardHighlights;

export function LeaderboardSkeleton() {
  const block = "rounded-lg bg-slate-200/80 dark:bg-slate-700/70";
  return (
    <div role="status" aria-label="Loading leaderboard" aria-busy="true" className="space-y-4 px-4 py-4 sm:px-6">
      <div aria-hidden="true" className="animate-pulse rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-4 motion-reduce:animate-none sm:flex sm:items-center sm:gap-6 sm:px-5 dark:border-slate-700/70 dark:bg-slate-950/30">
        <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
          <div className={`h-10 w-10 ${block}`} />
          <div className="space-y-2"><div className={`h-3 w-24 ${block}`} /><div className={`h-2 w-32 ${block}`} /></div>
        </div>
        <div className="mx-auto grid w-full max-w-3xl grid-cols-3 items-end gap-2 pt-8 sm:gap-4">
          {[0, 1, 2].map(index => (
            <div key={index} className="flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-4 dark:border-slate-700 dark:bg-slate-900">
              <div className={`${index === 1 ? "h-16 w-16" : "h-12 w-12"} rounded-full bg-slate-200/80 dark:bg-slate-700/70`} />
              <div className={`h-3 w-4/5 max-w-24 ${block}`} />
              <div className={`h-7 w-12 ${block}`} /><div className={`h-2 w-10 ${block}`} />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="animate-pulse overflow-hidden rounded-2xl border border-slate-200/80 motion-reduce:animate-none dark:border-slate-700/70">
        <div className="flex items-center gap-4 border-b border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-800/70">
          <div className={`h-2 w-8 ${block}`} /><div className={`h-2 w-24 ${block}`} /><div className={`ml-auto h-2 w-16 ${block}`} />
        </div>
        {[0, 1, 2, 3, 4].map(index => (
          <div key={index} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
            <div className={`h-8 w-8 shrink-0 ${block}`} /><div className={`h-10 w-10 shrink-0 ${block}`} />
            <div className={`h-3 w-24 sm:w-40 ${block}`} />
            <div className={`ml-auto h-5 w-12 shrink-0 ${block}`} /><div className={`hidden h-5 w-12 sm:block ${block}`} /><div className={`hidden h-5 w-12 md:block ${block}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardTabs({ value, onChange, compact = false }: { value: RankingMetric; onChange: (value: RankingMetric) => void; compact?: boolean }) {
  const tabs = [
    { value: "attempts" as const, label: "Attempts", icon: BarChart3, activeStyle: "from-indigo-600 to-violet-600 shadow-indigo-500/25", activeText: "text-indigo-700" },
    { value: "accuracy" as const, label: "Accuracy", icon: Target, activeStyle: "from-emerald-700 to-teal-700 shadow-emerald-500/25", activeText: "text-emerald-700" },
    { value: "maxStreak" as const, label: "Streak", icon: Flame, activeStyle: "from-orange-700 to-rose-700 shadow-orange-500/25", activeText: "text-orange-700" },
  ];
  return (
    <div role="group" aria-label="Leaderboard ranking" className={compact ? "flex gap-0.5 rounded-full bg-white/10 p-0.5 ring-1 ring-inset ring-white/20" : "flex gap-1 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700"}>
      {tabs.map(tab => (
        <button key={tab.value} type="button" aria-pressed={value === tab.value} onClick={() => onChange(tab.value)}
          className={compact
            ? `flex items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${value === tab.value ? `bg-white ${tab.activeText}` : "text-white/80 hover:bg-white/15 hover:text-white"}`
            : `flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:px-5 sm:text-sm ${value === tab.value ? `bg-gradient-to-br text-white shadow-md ${tab.activeStyle}` : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"}`}>
          <tab.icon aria-hidden="true" className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />{tab.label}
        </button>
      ))}
    </div>
  );
}

export function LeaderboardPodiums({ highlights, exam, metric }: { highlights: LeaderboardHighlights; exam: string; metric: RankingMetric }) {
  const sections = [
    { key: "attempts" as const, title: "Most attempts", subtitle: exam === "all" ? "Across all exams" : exam,
      icon: BarChart3, theme: "from-indigo-500 to-violet-600", iconStyle: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
      value: (entry: LeaderboardEntry) => entry.totalAttempts.toLocaleString(), unit: "attempts" },
    { key: "accuracy" as const, title: "Highest accuracy", subtitle: `${exam === "all" ? "All exams" : exam} / 100+ attempts`,
      icon: Target, theme: "from-emerald-500 to-teal-600", iconStyle: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      value: (entry: LeaderboardEntry) => `${entry.accuracy.toFixed(1)}%`, unit: "accuracy" },
    { key: "maxStreak" as const, title: "Best-ever streak", subtitle: "Overall / Across all exams",
      icon: Flame, theme: "from-amber-400 to-orange-500", iconStyle: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      value: (entry: LeaderboardEntry) => (entry.maxStreak || 0).toLocaleString(), unit: "correct in a row" },
  ];
  return (
    <div className="bg-slate-50/80 px-4 py-3 sm:px-6 dark:bg-slate-950/30">
      {sections.filter(section => section.key === metric).map(section => (
        <section key={section.key} aria-labelledby={`podium-${section.key}`}
          className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-4 shadow-sm sm:flex sm:items-center sm:gap-6 sm:px-5 dark:border-slate-700/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 sm:w-56 sm:shrink-0">
            <span className={`rounded-xl p-2 ${section.iconStyle}`}><section.icon aria-hidden="true" className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h3 id={`podium-${section.key}`} className="text-sm font-black sm:text-base">{section.title}</h3>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400" title={section.subtitle}>{section.subtitle}</p>
              {section.key === "maxStreak" && <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Streak: number of consecutive correct answers.</p>}
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">Top 3</span>
          </div>
          {highlights[section.key].length ? (
            <ol className="mx-auto grid w-full max-w-3xl grid-cols-3 items-end gap-2 pt-8 sm:gap-4">
              {highlights[section.key].map((entry, index) => (
                <li key={entry.id} className={`relative row-start-1 flex min-w-0 flex-col items-center rounded-2xl border px-2 py-3 text-center sm:px-3 ${index === 0 ? "col-start-2 border-amber-300 bg-gradient-to-b from-amber-50 via-white to-amber-50/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-200/50 dark:border-amber-500/50 dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 dark:ring-amber-500/10" : index === 1 ? "col-start-1 border-slate-200 bg-gradient-to-b from-slate-100 to-white shadow-sm dark:border-slate-700 dark:from-slate-800 dark:to-slate-900" : "col-start-3 border-orange-200/80 bg-gradient-to-b from-orange-50 to-white shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-slate-900"}`}>
                  <div className="relative mb-3">
                    {index === 0 && <Crown aria-hidden="true" className="absolute -top-6 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-500" />}
                    {entry.avatarUrl
                      ? <img src={entry.avatarUrl} alt="" decoding="async" className={`rounded-full border-4 object-cover shadow-md ${index === 0 ? "h-16 w-16 border-amber-300" : "h-12 w-12 border-slate-100 dark:border-slate-700"}`} />
                      : <span aria-hidden="true" className={`flex items-center justify-center rounded-full border-4 font-black shadow-md ${section.iconStyle} ${index === 0 ? "h-16 w-16 border-amber-300 text-2xl" : "h-12 w-12 border-slate-100 text-lg dark:border-slate-700"}`}>{entry.alias[0]?.toUpperCase()}</span>}
                    <span className={`absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-black dark:border-slate-900 ${index === 0 ? "bg-amber-400 text-amber-950" : index === 1 ? "bg-slate-300 text-slate-800" : "bg-orange-200 text-orange-900"}`}>{entry.rank}</span>
                  </div>
                  <span className="w-full truncate text-xs font-bold sm:text-sm" title={entry.alias}>{entry.alias}</span>
                  <span className="h-5 text-[10px] font-bold text-indigo-500">{entry.isYou ? "You" : entry.isSample ? "Sample" : ""}</span>
                  <strong className="text-xl font-black tracking-tight tabular-nums sm:text-2xl">{section.value(entry)}</strong>
                  <span className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{section.unit}</span>
                  <div aria-hidden="true" className={`mt-3 h-1 w-10 rounded-full bg-gradient-to-r ${section.theme} ${index === 0 ? "opacity-100" : "opacity-40"}`} />
                </li>
              ))}
            </ol>
          ) : <p className="py-16 text-center text-sm text-slate-500">{metric === "accuracy" ? "No learners have reached 100 attempts yet." : "No attempts recorded yet."}</p>}
        </section>
      ))}
    </div>
  );
}

export function LearnerExamBreakdown({ breakdown }: { breakdown: LeaderboardEntry["examBreakdown"] }) {
  const total = breakdown.reduce((sum, item) => sum + item.attempts, 0);
  if (!total) return null;
  const colors = ["bg-indigo-500", "bg-blue-500", "bg-violet-500", "bg-cyan-500", "bg-amber-500", "bg-fuchsia-500"];
  return (
    <div className="mt-1.5 w-72 max-w-full rounded-lg bg-white px-2.5 py-2 shadow-sm sm:w-[29rem] dark:bg-slate-800">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[8px] font-bold text-slate-400">
        <span className="uppercase tracking-wide">Exam split</span>
        <span className="tabular-nums" title="All exams / Lifetime attempts">{total.toLocaleString()} total</span>
      </div>
      <div aria-hidden="true" className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        {breakdown.map((item, index) => <span key={item.exam} title={`${item.exam}: ${item.attempts} attempts`} className={colors[index % colors.length]} style={{ width: `${item.attempts / total * 100}%` }} />)}
      </div>
      <ul tabIndex={0} aria-label="Exam-wise attempts" className="flex gap-2 overflow-x-auto overscroll-x-contain rounded pb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
        {breakdown.map((item, index) => (
          <li key={item.exam} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[8px] font-semibold text-slate-500 dark:text-slate-300">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors[index % colors.length]}`} />
            <span>{item.exam}</span>
            <strong className="font-bold tabular-nums text-slate-700 dark:text-slate-100">{item.attempts.toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeaderboardTable({ entries, overall, metric = "attempts" }: { entries: LeaderboardEntry[]; overall: boolean; metric?: RankingMetric }) {
  const columnHighlight = {
    attempts: "bg-indigo-100/70 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    accuracy: "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    maxStreak: "bg-orange-100/70 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  }[metric];
  return (
    <div className="mx-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:mx-6 dark:border-slate-700/70 dark:bg-slate-900">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">Ranked by {metric === "attempts" ? "total attempts" : metric === "accuracy" ? "accuracy" : "best-ever streak"}, highest first</caption>
        <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Rank</th><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Exam split</th>
            <th aria-sort={metric === "attempts" ? "descending" : undefined} className={`px-4 py-3 text-right ${metric === "attempts" ? columnHighlight : ""}`}>Attempts</th><th className="px-4 py-3 text-right">Correct</th>
            <th className="px-4 py-3 text-right">Wrong</th>
            <th aria-sort={metric === "accuracy" ? "descending" : undefined} className={`px-4 py-3 text-right ${metric === "accuracy" ? columnHighlight : ""}`}>Accuracy</th>
            {overall && <><th className="px-4 py-3 text-right">Current streak</th><th aria-sort={metric === "maxStreak" ? "descending" : undefined} className={`px-4 py-3 text-right ${metric === "maxStreak" ? columnHighlight : ""}`}>Best streak</th></>}
          </tr>
        </thead>
        {entries.map(entry => (
          <tbody key={entry.id} className={`border-t border-slate-100 transition-colors dark:border-slate-800 ${entry.isYou ? "bg-indigo-50/80 hover:bg-indigo-100/70 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"}`}>
            <tr>
              <td rowSpan={2} className="px-4 py-3"><span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-xs font-black tabular-nums ${entry.rank === 1 ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30" : entry.rank === 2 ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : entry.rank === 3 ? "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" : "text-slate-400"}`}>#{entry.rank}</span></td>
              <td rowSpan={2} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {entry.avatarUrl
                    ? <img src={entry.avatarUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-2xl bg-indigo-50 object-cover ring-1 ring-slate-200/70 dark:ring-slate-700" />
                    : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">{entry.alias[0]?.toUpperCase()}</span>}
                  <span className="font-semibold">{entry.alias}{entry.isSample && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Sample</span>}{entry.isYou && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">(You)</span>}</span>
                  {metric === "accuracy" && !entry.accuracyQualified && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">Under 100 attempts</span>}
                </div>
              </td>
              <td rowSpan={2} className="px-4 py-3"><LearnerExamBreakdown breakdown={entry.examBreakdown ?? []} /></td>
              <td className={`px-4 pt-3 pb-1 text-right tabular-nums ${metric === "attempts" ? columnHighlight : ""}`}><span className={metric === "attempts" ? "rounded-lg bg-indigo-50 px-2 py-1 font-black text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : ""}>{entry.totalAttempts.toLocaleString()}</span></td>
              <td className="px-4 pt-3 pb-1 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{entry.correctAttempts.toLocaleString()}</td>
              <td className="px-4 pt-3 pb-1 text-right tabular-nums">{entry.wrongAttempts.toLocaleString()}</td>
              <td className={`px-4 pt-3 pb-1 text-right tabular-nums ${metric === "accuracy" ? columnHighlight : ""}`}><span className={`rounded-lg px-2 py-1 ${entry.accuracy < 50 ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"} ${metric === "accuracy" ? "font-black" : "font-semibold"}`}>{entry.accuracy.toFixed(1)}%</span></td>
              {overall && <><td className="px-4 pt-3 pb-1 text-right tabular-nums">{entry.currentStreak}</td><td className={`px-4 pt-3 pb-1 text-right font-bold tabular-nums ${metric === "maxStreak" ? columnHighlight : ""}`}><span className={metric === "maxStreak" ? "rounded-lg bg-orange-50 px-2 py-1 font-black text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : ""}>{entry.maxStreak}</span></td></>}
            </tr>
            <tr>
              <td colSpan={overall ? 6 : 4} className="px-4 pb-3">
                <div role="img" aria-label={`${entry.totalAttempts.toLocaleString()} attempts: ${entry.correctAttempts.toLocaleString()} correct, ${entry.wrongAttempts.toLocaleString()} wrong`}
                  title={`${entry.correctAttempts.toLocaleString()} correct, ${entry.wrongAttempts.toLocaleString()} wrong`}
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span className="bg-emerald-500/80" style={{ width: `${entry.totalAttempts ? entry.correctAttempts / entry.totalAttempts * 100 : 0}%` }} />
                  <span className="bg-rose-500/80" style={{ width: `${entry.totalAttempts ? entry.wrongAttempts / entry.totalAttempts * 100 : 0}%` }} />
                </div>
              </td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function Leaderboard({ userEmail, onClose }: { userEmail: string | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [exam, setExam] = useState("all");
  const [sort, setSort] = useState<RankingMetric>("attempts");
  const [exams, setExams] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResponseData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const effectiveExam = sort === "maxStreak" ? "all" : exam;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setData(null);
    const query = new URLSearchParams({ exam: effectiveExam, sort, page: String(page) });
    if (userEmail) query.set("email", userEmail);
    fetch(`/api/leaderboard?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load the leaderboard.");
        if (!controller.signal.aborted) {
          setData(result);
          setExams(result.exams);
        }
      })
      .catch(caught => { if (!controller.signal.aborted) setError(caught.message || "Could not load the leaderboard."); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [effectiveExam, sort, page, revision, userEmail]);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="leaderboard-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto h-[94dvh] max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-[1480px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm sm:w-[calc(100%_-_3rem)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="sticky top-0 z-10 isolate flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-900 px-3 py-2 text-white sm:px-4">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/90 text-amber-950">
            <Trophy className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <h2 id="leaderboard-title" className="          text-base font-extrabold tracking-tight">Leaderboard</h2>
        </div>
                  <LeaderboardTabs compact value={sort} onChange={value => { setSort(value); setPage(1); }} />
                  <label className="ml-auto w-36 text-xs font-bold text-white/80 sm:w-44"><span className="sr-only">Exam</span>
          <select aria-label="Exam" value={effectiveExam} disabled={sort === "maxStreak"} onChange={event => {
            setExam(event.target.value); setPage(1);
                    }} className="block w-full rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:text-slate-800">
            <option value="all">All exams</option>
            {[...new Set([...exams, ...(exam === "all" ? [] : [exam])])].map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" onClick={reload} disabled={busy} aria-label="Refresh leaderboard"         className="rounded-full bg-white/10 p-1.5 text-white/80 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /></button>
                <button type="button" autoFocus aria-label="Close leaderboard" onClick={onClose} className="rounded-full bg-white/10 p-1.5 text-white/80 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      {busy && <LeaderboardSkeleton />}
      {error && <div role="alert" className="m-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}<button type="button" onClick={reload} className="ml-3 font-bold underline">Retry</button></div>}
      {data && <>
        <LeaderboardPodiums highlights={data.highlights} exam={effectiveExam} metric={sort} />
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            {data.me && <span className="rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Your rank: #{data.me.rank}</span>}
          </div>
          <span>{data.pendingUpdates ? "Some saved answers are still being processed." : sort === "accuracy" ? "Accuracy is ranked for learners with 100+ attempts; others are listed below them." : ""}</span>
        </div>
        {data.entries.length ? <LeaderboardTable entries={data.entries} overall={effectiveExam === "all"} metric={sort} /> : <p className="p-10 text-center text-sm text-slate-500">No rankings for this exam yet.</p>}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <button type="button" disabled={page === 1 || busy} onClick={() => setPage(value => value - 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /> Previous</button>
          <span className="text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
          <button type="button" disabled={page * data.pageSize >= data.total || busy} onClick={() => setPage(value => value + 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800">Next <ChevronRight className="h-4 w-4" /></button>
        </div>
      </>}
    </dialog>, document.body,
  );
}
