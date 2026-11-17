import type { SearchRun } from "./schema";

export function exportResults(run: SearchRun) {
  // Explicit allowlist: keys, prompts, transport metadata, and raw page bodies never enter exports.
  const data = {
    version: 2,
    query: run.config.query,
    scope: run.config.scope,
    searchedAt: run.startedAt,
    status: run.phase,
    ...(run.keylessPreview ? { keylessPreview: run.keylessPreview } : {}),
    note: "Passages selected directly from source text returned by Interfaze. Relevance and authorship interpretation require source review; affiliations are historical.",
    people: run.experts.map(({ name, affiliation, evidence, contacts }) => ({
      name,
      affiliation,
      evidence,
      contacts: contacts ?? [],
    })),
    sources: run.sources.map(({ url, title, kind, status, note }) => ({
      url,
      title,
      kind,
      status,
      note,
    })),
  };
  return JSON.stringify(data, null, 2);
}
export function downloadResults(run: SearchRun) {
  const url = URL.createObjectURL(
    new Blob([exportResults(run)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "interfaze-people-search.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
