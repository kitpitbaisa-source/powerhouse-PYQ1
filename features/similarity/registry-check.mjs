import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const words = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const label = value => words(value).join("");
const unique = values => [...new Set(values)];
const definition = value => ({
  id: value.id, canonical_name: value.canonical_name, definition: value.definition,
  subject: value.subject, topic: value.topic, aliases: [...value.aliases].sort(),
  parentConceptIds: [...value.parentConceptIds].sort(),
});
const canonical = value => ({
  ...definition(value), status: value.status, taxonomyVersion: value.taxonomyVersion, retirement: value.retirement,
});

export const recordFingerprint = record => hash(canonical(record));
export const registryFingerprint = records => hash([...records]
  .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(canonical));
export const reviewTaskFingerprint = (targets, records) => hash({
  contexts: targets.map(targetFingerprint), records: records.map(recordFingerprint),
});

export function targetFingerprint(target) {
  assert(target?.id === target.definition?.id && Array.isArray(target.sources) && target.sources.length,
    "A comparison target requires its exact definition and source contexts.");
  for (const source of target.sources) {
    assert(typeof source.id === "string" && typeof source.question?.question === "string" &&
      Array.isArray(source.question.options) && typeof source.role === "string",
    "A comparison target has incomplete source context.");
  }
  return hash({ definition: definition(target.definition),
    sources: [...target.sources].sort((a, b) => a.id.localeCompare(b.id)) });
}

export function createRegistryIndex(records) {
  const byId = new Map();
  const postings = new Map();
  for (const record of records) {
    assert(typeof record.id === "string" && !byId.has(record.id) &&
      ["active", "provisional", "retired"].includes(record.status) &&
      ["canonical_name", "definition", "subject", "topic", "taxonomyVersion"].every(key => typeof record[key] === "string") &&
      Array.isArray(record.aliases) && record.aliases.every(value => typeof value === "string") &&
      Array.isArray(record.parentConceptIds) && record.parentConceptIds.every(value => typeof value === "string"),
    "Invalid or duplicated canonical registry record.");
    byId.set(record.id, record);
    const terms = new Map();
    for (const [text, weight] of [[record.id, 8], [record.canonical_name, 6], [record.aliases.join(" "), 5],
      [record.definition, 1], [`${record.subject} ${record.topic}`, 0.25]]) {
      for (const term of new Set(words(text))) terms.set(term, (terms.get(term) ?? 0) + weight);
    }
    for (const [term, weight] of terms) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(record.id, weight);
    }
  }
  function search({ query = "", subject = "", topic = "", status = "current", offset = 0, limit = 30 } = {}) {
    assert(typeof query === "string" && query.length <= 4000 && Number.isSafeInteger(offset) && offset >= 0 &&
      Number.isSafeInteger(limit) && limit > 0 && limit <= 100 &&
      ["current", "all", "active", "provisional", "retired"].includes(status), "Invalid registry search.");
    const scores = new Map();
    const tokens = unique(words(query));
    for (const token of tokens) {
      const entries = postings.get(token);
      if (!entries) continue;
      const idf = Math.log(1 + (records.length + 0.5) / (entries.size + 0.5));
      for (const [id, weight] of entries) scores.set(id, (scores.get(id) ?? 0) + weight * idf);
    }
    const exact = label(query);
    const hits = [];
    for (const record of records) {
      if ((status === "current" ? record.status === "retired" : status !== "all" && record.status !== status) ||
        (subject && record.subject !== subject) || (topic && record.topic !== topic)) continue;
      const exactLabel = exact && [record.id, record.canonical_name, ...record.aliases].some(value => label(value) === exact);
      if (tokens.length && !scores.has(record.id) && !exactLabel) continue;
      hits.push({ ...record, score: (scores.get(record.id) ?? 0) + (exactLabel ? 1000 : 0) });
    }
    hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return { total: hits.length, offset, limit, results: hits.slice(offset, offset + limit),
      candidateSearchOnly: true };
  }
  return { byId, search, registryFingerprint: registryFingerprint(records),
    subjects: unique(records.map(record => record.subject)).sort(),
    topics: unique(records.map(record => record.topic)).sort() };
}

export function createCompletedReceipt(targets, records, review) {
  assert(review?.comparedAllRows === true && typeof review.reviewedBy === "string" && review.reviewedBy.trim() &&
    typeof review.rationale === "string" && review.rationale.trim() &&
    typeof review.reviewedAt === "string" && Number.isFinite(Date.parse(review.reviewedAt)),
  "A receipt requires an identified reviewer's explicit complete-comparison attestation.");
  const contexts = targets.map(target => ({ id: target.id, fingerprint: targetFingerprint(target) }));
  const candidates = records.map(record => ({ id: record.id, fingerprint: recordFingerprint(record) }));
  assert(contexts.length && candidates.length && new Set(contexts.map(row => row.id)).size === contexts.length &&
    new Set(candidates.map(row => row.id)).size === candidates.length, "Empty or duplicate comparison scope.");
  const receipt = { formatVersion: 1, contexts, records: candidates,
    reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt, rationale: review.rationale,
    comparedAllRows: true, decisions: review.decisions,
    ...(review.supersedes ? { supersedes: review.supersedes } : {}) };
  return validateReceipt({ ...receipt, id: hash(receipt) });
}

export function validateReceipt(receipt) {
  const { id, ...body } = receipt;
  assert(body.formatVersion === 1 && digest(id) && id === hash(body) && body.comparedAllRows === true &&
    typeof body.reviewedBy === "string" && body.reviewedBy.trim() &&
    typeof body.rationale === "string" && body.rationale.trim() &&
    typeof body.reviewedAt === "string" && Number.isFinite(Date.parse(body.reviewedAt)),
  "Invalid or corrupted registry comparison receipt.");
  assert(body.supersedes === undefined || (Array.isArray(body.supersedes) &&
    body.supersedes.every(digest) && unique(body.supersedes).length === body.supersedes.length &&
    !body.supersedes.includes(id)), "Invalid superseded review references.");
  assert(Array.isArray(body.contexts) && body.contexts.length && Array.isArray(body.records) && body.records.length &&
    [...body.contexts, ...body.records].every(row => typeof row.id === "string" && digest(row.fingerprint)),
  "Invalid comparison receipt bindings.");
  const targets = new Set(body.contexts.map(row => row.id));
  const candidates = new Set(body.records.map(row => row.id));
  assert(targets.size === body.contexts.length && candidates.size === body.records.length &&
    Array.isArray(body.decisions) && body.decisions.length === targets.size &&
    new Set(body.decisions.map(row => row.concept_id)).size === targets.size,
  "Comparison receipt has missing or duplicated decisions.");
  for (const decision of body.decisions) {
    assert(targets.has(decision.concept_id) && typeof decision.uncertain === "boolean" &&
      typeof decision.rationale === "string" && decision.rationale.trim() &&
      Array.isArray(decision.equivalent_ids) && Array.isArray(decision.related_ids) &&
      [...decision.equivalent_ids, ...decision.related_ids].every(candidate => candidates.has(candidate)) &&
      unique([...decision.equivalent_ids, ...decision.related_ids]).length ===
        decision.equivalent_ids.length + decision.related_ids.length,
    "Comparison receipt has an invalid identity decision.");
  }
  return receipt;
}

export function createRegistryChecker(workspace) {
  assert(workspace.formatVersion === 1 && Array.isArray(workspace.targets) && Array.isArray(workspace.receipts),
    "Invalid registry checking workspace.");
  const index = createRegistryIndex(workspace.concepts);
  assert(index.registryFingerprint === workspace.registryFingerprint, "Registry snapshot fingerprint mismatch.");
  const targets = new Map(workspace.targets.map(target => [target.id, target]));
  assert(targets.size === workspace.targets.length, "Duplicated comparison target.");
  const contexts = new Map(workspace.targets.map(target => [target.id, targetFingerprint(target)]));
  const hashes = new Map(workspace.concepts.map(record => [record.id, recordFingerprint(record)]));
  const receipts = workspace.receipts.map(validateReceipt);
  const receiptIds = new Set(receipts.map(receipt => receipt.id));
  for (const receipt of receipts) assert((receipt.supersedes ?? []).every(id => receiptIds.has(id)),
    "A superseding review references an unavailable receipt.");
  const active = workspace.concepts.filter(record => record.status !== "retired");
  const states = new Map();
  function comparisons(id) {
    assert(targets.has(id), "Unknown comparison target.");
    if (states.has(id)) return states.get(id);
    const result = new Map();
    const uncertain = new Set();
    const scoped = receipts.filter(receipt =>
      receipt.contexts.some(context => context.id === id && context.fingerprint === contexts.get(id)));
    const superseded = new Map();
    for (const receipt of scoped) for (const record of receipt.records) {
      if (hashes.get(record.id) !== record.fingerprint || !receipt.supersedes?.length) continue;
      if (!superseded.has(record.id)) superseded.set(record.id, new Set());
      for (const old of receipt.supersedes) superseded.get(record.id).add(old);
    }
    for (const receipt of scoped) {
      const decision = receipt.decisions.find(row => row.concept_id === id);
      if (decision.uncertain) {
        for (const record of receipt.records) if (hashes.get(record.id) === record.fingerprint &&
          index.byId.get(record.id)?.status !== "retired" && !superseded.get(record.id)?.has(receipt.id)) uncertain.add(record.id);
        continue;
      }
      const equivalents = new Set(decision.equivalent_ids);
      const related = new Set(decision.related_ids);
      for (const record of receipt.records) {
        if (hashes.get(record.id) !== record.fingerprint || index.byId.get(record.id)?.status === "retired" ||
          superseded.get(record.id)?.has(receipt.id)) continue;
        const relation = equivalents.has(record.id) ? "equivalent" : related.has(record.id) ? "related" : "different";
        const previous = result.get(record.id);
        result.set(record.id, previous && previous !== relation ? "conflict" : relation);
      }
    }
    if (states.size >= 8) states.delete(states.keys().next().value);
    const value = { checked: result, uncertain };
    states.set(id, value);
    return value;
  }
  function targetPlan(id) {
    const { checked, uncertain } = comparisons(id);
    const remainingIds = active.filter(record => !checked.has(record.id) || checked.get(record.id) === "conflict")
      .map(record => record.id);
    return { id, contextFingerprint: contexts.get(id), registryCount: active.length,
      coveredCount: active.length - remainingIds.length, remainingIds,
      uncertainIds: remainingIds.filter(id => uncertain.has(id) && checked.get(id) !== "conflict"),
      unreviewedIds: remainingIds.filter(id => !uncertain.has(id) || checked.get(id) === "conflict"),
      equivalentIds: [...checked].filter(([, state]) => state === "equivalent").map(([candidate]) => candidate),
      relatedIds: [...checked].filter(([, state]) => state === "related").map(([candidate]) => candidate),
      conflicts: [...checked].filter(([, state]) => state === "conflict").map(([candidate]) => candidate),
      complete: remainingIds.length === 0, admissionApproved: false };
  }
  const plans = workspace.targets.map(target => targetPlan(target.id));
  const planById = new Map(plans.map(plan => [plan.id, plan]));
  return {
    search(options, targetId) {
      const found = index.search(options);
      return { ...found, results: found.results.map(record => ({ ...record,
        comparison: targetId ? comparisons(targetId).checked.get(record.id) ??
          (comparisons(targetId).uncertain.has(record.id) ? "uncertain" : "not_reviewed") : null })) };
    },
    target(id) {
      assert(targets.has(id), "Unknown comparison target.");
      return { ...targets.get(id), plan: planById.get(id),
        reviews: receipts.filter(receipt => receipt.contexts.some(context =>
          context.id === id && context.fingerprint === contexts.get(id))).map(receipt => ({
          id: receipt.id, reviewedBy: receipt.reviewedBy, reviewedAt: receipt.reviewedAt,
          rationale: receipt.rationale, recordCount: receipt.records.length, supersedes: receipt.supersedes,
          decision: receipt.decisions.find(decision => decision.concept_id === id),
        })),
        candidates: this.search({ query: targets.get(id).definition.canonical_name, limit: 12 }, id).results };
    },
    summary: {
      capturedAt: workspace.capturedAt, registryFingerprint: index.registryFingerprint,
      registryCount: workspace.concepts.length, activeRegistryCount: active.length,
      subjects: index.subjects, topics: index.topics, receiptCount: receipts.length,
      targets: workspace.targets.map(target => ({ id: target.id, name: target.definition.canonical_name,
        ...planById.get(target.id), remainingIds: undefined, uncertainIds: undefined, unreviewedIds: undefined,
        uncertainCount: planById.get(target.id).uncertainIds.length })),
      coveredComparisons: plans.reduce((sum, plan) => sum + plan.coveredCount, 0),
      remainingComparisons: plans.reduce((sum, plan) => sum + plan.remainingIds.length, 0),
      uncertainComparisons: plans.reduce((sum, plan) => sum + plan.uncertainIds.length, 0),
      admissionApproved: false,
      notice: "Candidate ranking is not semantic approval. Cached comparisons do not replace current source, role, coverage, highlight, cross-proposal or final live-registry admission review.",
    },
    reviewTasks(chunkSize = 250, includeUncertain = false) {
      assert(Number.isSafeInteger(chunkSize) && chunkSize > 0 && chunkSize <= 1000);
      const pending = new Map();
      for (const plan of plans) for (const recordId of includeUncertain ? plan.remainingIds : plan.unreviewedIds) {
        if (!pending.has(recordId)) pending.set(recordId, []);
        pending.get(recordId).push(plan.id);
      }
      const groups = new Map();
      for (const [recordId, targetIds] of pending) {
        const key = JSON.stringify(targetIds.sort());
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(index.byId.get(recordId));
      }
      const tasks = [];
      for (const [key, records] of groups) {
        records.sort((a, b) => a.id.localeCompare(b.id));
        const targetIds = JSON.parse(key);
        for (let start = 0; start < records.length; start += chunkSize) {
          const selected = records.slice(start, start + chunkSize);
          const id = reviewTaskFingerprint(targetIds.map(id => targets.get(id)), selected);
          tasks.push({ id, targetIds, records: selected });
        }
      }
      return { formatVersion: 1, registryFingerprint: index.registryFingerprint, targets: workspace.targets,
        tasks, admissionApproved: false, uncertainComparisons: this.summary.uncertainComparisons,
        instruction: "Compare every target with every record in its task using the full source context and meaning/scope. Return taskId, reviewedBy, reviewedAt, rationale, comparedAllRows:true and one decision per target (concept_id, equivalent_ids, related_ids, uncertain, rationale). Resolving conflicting earlier judgments also requires explicit supersedes:[receipt IDs] and an evidence-backed rationale; history is retained. No result authorizes a canonical write or source-flag clearance." };
    },
  };
}
