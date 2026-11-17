"use client";
import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { ArrowUpRight, Download, SearchX } from "lucide-react";
import type { Expert, SearchRun, SearchScope } from "@/lib/schema";
import { downloadResults } from "@/lib/export";
import { groupResults } from "@/lib/result-groups";
import { SourceGroup } from "./SourceGroup";
import { SearchProgress } from "./SearchProgress";

export function Results({
  run,
  onSelect,
  onReset,
}: {
  run: SearchRun;
  onSelect: (expert: Expert, sourceId: string) => void;
  onReset: () => void;
}) {
  const [filter, setFilter] = useState<SearchScope>("all");
  const busy = run.phase === "discovering" || run.phase === "reading";
  const groups = groupResults(run.experts, run.sources, filter);
  const experts = run.experts.filter(
    (p) => filter === "all" || p.evidence.some((e) => e.kind === filter),
  );
  return (
    <section className="results" aria-label="Search results">
      <SearchProgress run={run} />
      {(run.experts.length > 0 || !busy) && (
        <div className="results-header">
          <div>
            <span className="eyebrow">PEOPLE & EVIDENCE</span>
            <h2 id="results-title">
              {run.experts.length ? (
                <>
                  {run.experts.length}{" "}
                  {run.experts.length === 1 ? "expert" : "experts"} discovered
                  <span className="accent-period">.</span>
                </>
              ) : (
                "Search results"
              )}
            </h2>
          </div>
          <div className="result-actions">
            {!busy && (
              <Button variant="ghost" onClick={onReset}>
                New search
              </Button>
            )}
          </div>
        </div>
      )}
      <p className="results-query">“{run.config.query}”</p>
      {run.keylessPreview && run.keylessPreview.selectedSources > 0 && (
        <p className="fine-print">
          Keyless preview · {run.keylessPreview.selectedSources} selected{" "}
          {run.keylessPreview.selectedSources === 1 ? "source" : "sources"} with
          inspectable evidence. Contact links in the source are included when
          available.
        </p>
      )}
      {run.warnings.map((warning, i) => (
        <p className="error-note" role="alert" key={i}>
          {warning}
        </p>
      ))}
      {run.experts.length > 0 && (
        <>
          <div className="results-toolbar">
            {run.config.scope === "all" ? (
              <div className="filter-buttons" aria-label="Filter results">
                {(
                  [
                    ["all", "All people"],
                    ["paper", "Paper authors"],
                    ["patent", "Inventors"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span>
                {run.config.scope === "paper"
                  ? "Paper authors"
                  : "Patent inventors"}
              </span>
            )}
            <span>
              {experts.length} {experts.length === 1 ? "person" : "people"} ·{" "}
              {groups.length} {groups.length === 1 ? "document" : "documents"}
            </span>
          </div>
          <div className="result-groups">
            {groups.map((group, i) => (
              <SourceGroup
                key={group.source.sourceId}
                group={group}
                index={i}
                onSelect={onSelect}
              />
            ))}
          </div>
          {!experts.length && (
            <p className="filter-empty">
              No people in this source category. Try All people.
            </p>
          )}
        </>
      )}
      {!busy && !run.experts.length && (
        <div className="empty-results">
          <SearchX size={26} />
          <h3>
            {run.phase === "cancelled"
              ? "Stopped before a match was found."
              : run.phase === "error"
                ? "The search couldn’t finish."
                : "No supported matches this time."}
          </h3>
          <p>
            {run.phase === "cancelled"
              ? "Start a new search whenever you’re ready."
              : run.phase === "error"
                ? "Check the message above, then try your search again."
                : "Try a specific technology, method, or research problem. People appear when a source supports both their name and your topic."}
          </p>
        </div>
      )}
      {run.sources.length > 0 && (
        <details className="source-log">
          <summary>
            Search details{" "}
            <span>
              {run.sources.length}{" "}
              {run.sources.length === 1 ? "document" : "documents"}
            </span>
          </summary>
          <div>
            <div className="source-log-tools">
              <span>{run.requests} API requests</span>
              {run.experts.length > 0 && (
                <Button variant="ghost" onClick={() => downloadResults(run)}>
                  <Download size={13} /> Export JSON
                </Button>
              )}
            </div>
            {run.sources.map((source) => (
              <div className="source-log-row" key={source.url}>
                <span className={`source-status status-${source.status}`}>
                  {
                    {
                      queued: "Queued",
                      reading: "Reading",
                      extracting: "Matching",
                      complete: "Matched",
                      skipped: "Skipped",
                      failed: "Unavailable",
                    }[source.status]
                  }
                </span>
                <div>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                    <ArrowUpRight size={12} />
                  </a>
                  {source.note && <p>{source.note}</p>}
                </div>
                <span>
                  {source.people
                    ? `${source.people} ${source.people === 1 ? "person" : "people"}`
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {run.experts.length > 0 && (
        <p className="results-disclaimer">
          Matches are based on published work. Open the evidence to review
          relevance and attribution.
        </p>
      )}
    </section>
  );
}
