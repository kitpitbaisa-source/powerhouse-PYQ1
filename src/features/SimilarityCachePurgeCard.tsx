import React, { useState } from "react";

const containers = [
  { value: "questions", label: "Prelims" },
  { value: "state_pcs", label: "State PCS" },
  { value: "mains-questions", label: "Mains" },
  { value: "csat-questions", label: "CSAT" },
  { value: "english-questions", label: "English" },
] as const;

type Result = { type: "success" | "error"; text: string };

export const SimilarityCachePurgeCard: React.FC<{ adminKey: string }> = ({ adminKey }) => {
  const [sourceContainer, setSourceContainer] = useState<string>("questions");
  const [questionId, setQuestionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const purge = async (body: Record<string, unknown>) => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/similarity-cache/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResult({
        type: "success",
        text: !data.purged
          ? "Nothing to purge (no stored results matched)."
          : data.scope === "all"
            ? "Purged the whole similarity cache."
            : `Purged ${data.tags} cached question${data.tags === 1 ? "" : "s"} (the question and ${data.neighbours} similar).`,
      });
    } catch (error) {
      setResult({ type: "error", text: error instanceof Error ? error.message : "Could not purge the cache." });
    } finally {
      setBusy(false);
    }
  };

  const id = questionId.trim();
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
      <h3 className="text-lg font-bold mb-1">Similarity cache</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        After changing a question&apos;s embedding or concepts, purge it here. Its similar questions are purged too.
      </p>
      {result && (
        <div className={result.type === "success"
          ? "mb-3 p-3 rounded-lg text-xs font-bold bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "mb-3 p-3 rounded-lg text-xs font-bold bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}>
          {result.text}
        </div>
      )}
      <form onSubmit={event => { event.preventDefault(); if (id) void purge({ sourceContainer, questionId: id }); }} className="space-y-3">
        <select
          value={sourceContainer}
          onChange={event => setSourceContainer(event.target.value)}
          aria-label="Question bank"
          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          {containers.map(container => <option key={container.value} value={container.value}>{container.label}</option>)}
        </select>
        <input
          value={questionId}
          onChange={event => setQuestionId(event.target.value)}
          placeholder="Master question ID, e.g. 110039"
          aria-label="Master question ID"
          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={busy || !id}
          className="w-full py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
        >
          {busy ? "Purging..." : "Purge question and similar"}
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={() => { if (window.confirm("Purge the similarity cache for every question?")) void purge({ all: true }); }}
        className="mt-2 w-full py-2 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 disabled:opacity-50 rounded-lg text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
      >
        Purge all similarity cache
      </button>
    </div>
  );
};
