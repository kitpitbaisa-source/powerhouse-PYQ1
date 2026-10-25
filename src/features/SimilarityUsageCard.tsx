import React, { useCallback, useEffect, useState } from "react";

interface UsageSummary {
  days: number;
  opens: number;
  clicks: number;
  storedOpens: number;
  computedOpens: number;
  medianMs: number | null;
  p90Ms: number | null;
  users: { email: string; opens: number; clicks: number; lastAt: string }[];
  topQuestions: { question: string; count: number }[];
  topMatches: { match: string; count: number }[];
}

const ranges = [1, 7, 30] as const;
const seconds = (ms: number | null) => (ms === null ? "-" : `${(ms / 1000).toFixed(1)}s`);

export const SimilarityUsageCard: React.FC<{ adminKey: string }> = ({ adminKey }) => {
  const [days, setDays] = useState<number>(7);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/similarity-usage?days=${days}`, {
        headers: { Authorization: `Bearer ${adminKey}` }, cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setSummary(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load usage.");
    } finally {
      setBusy(false);
    }
  }, [adminKey, days]);

  useEffect(() => { void load(); }, [load]);

  const stat = (label: string, value: string | number) => (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-center">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">{label}</div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold">Similarity usage</h3>
        <div className="flex gap-1">
          {ranges.map(range => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={days === range
                ? "px-2 py-1 rounded-md text-[11px] font-bold bg-indigo-600 text-white"
                : "px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}
            >
              {range === 1 ? "24h" : `${range}d`}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Popup opens, how fast results load, and which matches get clicked.</p>
      {error && <div className="mb-3 p-3 rounded-lg text-xs font-bold bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">{error}</div>}
      {busy && !summary && <p className="text-xs text-slate-500">Loading...</p>}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {stat("Opens", summary.opens)}
            {stat("Match clicks", summary.clicks)}
            {stat("Stored", `${summary.storedOpens}/${summary.opens}`)}
            {stat("Computed", summary.computedOpens)}
            {stat("Median", seconds(summary.medianMs))}
            {stat("Slowest 10%", seconds(summary.p90Ms))}
          </div>
          <div>
            <h4 className="text-xs font-bold mb-2">Users</h4>
            {summary.users.length === 0 ? <p className="text-xs text-slate-500">No activity yet.</p> : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0">
                    <tr><th className="text-left p-2">User</th><th className="p-2">Opens</th><th className="p-2">Clicks</th><th className="text-right p-2">Last</th></tr>
                  </thead>
                  <tbody>
                    {summary.users.map(user => (
                      <tr key={user.email} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="p-2 truncate max-w-[10rem]">{user.email}</td>
                        <td className="p-2 text-center">{user.opens}</td>
                        <td className="p-2 text-center">{user.clicks}</td>
                        <td className="p-2 text-right text-slate-500">{new Date(user.lastAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {summary.topQuestions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold mb-2">Most opened questions</h4>
              <ul className="text-xs space-y-1">
                {summary.topQuestions.map(item => <li key={item.question} className="flex justify-between"><span>{item.question}</span><span className="font-bold">{item.count}</span></li>)}
              </ul>
            </div>
          )}
          {summary.topMatches.length > 0 && (
            <div>
              <h4 className="text-xs font-bold mb-2">Most clicked matches</h4>
              <ul className="text-xs space-y-1">
                {summary.topMatches.map(item => <li key={item.match} className="flex justify-between"><span>{item.match}</span><span className="font-bold">{item.count}</span></li>)}
              </ul>
            </div>
          )}
          <button type="button" onClick={() => void load()} disabled={busy} className="w-full py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50">
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}
    </div>
  );
};
