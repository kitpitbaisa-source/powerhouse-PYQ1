import React, { useCallback, useEffect, useState } from "react";

interface AttemptsSummary {
  users: { email: string; questions: number; attempts: number; lastAt: string | null }[];
  totals: { users: number; questions: number; attempts: number };
}

export const SimilarityAttemptsCard: React.FC<{ adminKey: string }> = ({ adminKey }) => {
  const [summary, setSummary] = useState<AttemptsSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/similarity-attempts", {
        headers: { Authorization: `Bearer ${adminKey}` }, cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setSummary(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load similarity attempts.");
    } finally {
      setBusy(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
      <h3 className="text-lg font-bold mb-1">Similarity attempts</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Questions each user answered from the similarity popup.</p>
      {error && <div className="mb-3 p-3 rounded-lg text-xs font-bold bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">{error}</div>}
      {busy && !summary && <p className="text-xs text-slate-500">Loading...</p>}
      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Users", summary.totals.users], ["Questions", summary.totals.questions], ["Attempts", summary.totals.attempts]].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3">
                <div className="text-lg font-black">{value}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">{label}</div>
              </div>
            ))}
          </div>
          {summary.users.length === 0 ? <p className="text-xs text-slate-500">No similarity attempts yet.</p> : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0">
                  <tr><th className="text-left p-2">User</th><th className="p-2">Questions</th><th className="p-2">Attempts</th><th className="text-right p-2">Last</th></tr>
                </thead>
                <tbody>
                  {summary.users.map(user => (
                    <tr key={user.email} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="p-2 truncate max-w-[10rem]">{user.email}</td>
                      <td className="p-2 text-center font-bold">{user.questions}</td>
                      <td className="p-2 text-center">{user.attempts}</td>
                      <td className="p-2 text-right text-slate-500">
                        {user.lastAt ? new Date(user.lastAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
