import {
  BookOpen,
  Check,
  FileSearch,
  Fingerprint,
  Pause,
  Search,
  Users,
  CircleAlert,
} from "lucide-react";
import type { SearchRun } from "@/lib/schema";

export function SearchProgress({ run }: { run: SearchRun }) {
  const busy = run.phase === "discovering" || run.phase === "reading";
  const settled = run.sources.filter((s) =>
    ["complete", "skipped", "failed"].includes(s.status),
  ).length;
  const matching =
    run.sources.some((s) => s.status === "extracting") ||
    run.experts.length > 0;
  const stage = run.phase === "discovering" ? 0 : matching ? 2 : 1;
  const title =
    run.phase === "discovering"
      ? "Following the research"
      : matching
        ? "Connecting people to their work"
        : "Reading the original sources";
  const scope =
    run.config.scope === "paper"
      ? "research papers"
      : run.config.scope === "patent"
        ? "patents"
        : "papers and patents";
  if (!busy) {
    return (
      <div className={`search-outcome outcome-${run.phase}`} role="status">
        {run.phase === "complete" ? (
          <Check size={15} />
        ) : run.phase === "cancelled" ? (
          <Pause size={15} />
        ) : (
          <CircleAlert size={15} />
        )}
        <span>
          {run.phase === "complete"
            ? "Search complete"
            : run.phase === "cancelled"
              ? "Search stopped"
              : "Search interrupted"}
        </span>
        <span className="outcome-detail">
          {run.phase === "complete"
            ? `${settled} ${settled === 1 ? "source" : "sources"} processed`
            : run.experts.length
              ? "Completed results kept"
              : "No results yet"}
        </span>
      </div>
    );
  }
  return (
    <div className="search-progress">
      <div className="progress-heading" role="status" aria-live="polite">
        <div>
          <h3>{title}</h3>
          <p>
            {run.phase === "discovering"
              ? `Searching public ${scope} for your topic.`
              : `${settled} of ${run.sources.length} sources processed · People appear as evidence is found.`}
          </p>
        </div>
      </div>
      <div className="discovery-flow" aria-label="Search stages">
        {[
          { label: "Find sources", icon: Search },
          { label: "Read documents", icon: BookOpen },
          { label: "Identify people", icon: Users },
        ].map(({ label, icon: Icon }, i) => (
          <div
            key={label}
            className={`flow-step ${i === stage ? "is-active" : i < stage ? "is-reached" : ""}`}
            aria-current={i === stage ? "step" : undefined}
          >
            <span className="flow-icon">
              <Icon size={19} />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {run.sources.length ? (
        <div className="document-grid">
          {run.sources.map((source, i) => {
            const active =
              source.status === "reading" || source.status === "extracting";
            const label =
              source.status === "reading"
                ? "Reading document"
                : source.status === "extracting"
                  ? "Matching people"
                  : source.status === "complete"
                    ? `${source.people} ${source.people === 1 ? "person" : "people"} found`
                    : source.status === "skipped"
                      ? "No supported match"
                      : source.status === "failed"
                        ? "Source unavailable"
                        : "Waiting to read";
            return (
              <div
                key={source.url}
                className={`document-tile ${active ? "is-scanning" : ""} document-${source.status}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="document-meta">
                  {source.kind === "paper" ? (
                    <BookOpen size={14} />
                  ) : (
                    <Fingerprint size={14} />
                  )}
                  <span>
                    {new URL(source.url).hostname.replace(/^www\./, "")}
                  </span>
                  {source.status === "complete" && <Check size={13} />}
                </div>
                <p title={source.title}>{source.title}</p>
                <span className="document-state" key={source.status}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="discovery-scan" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              className="scan-page"
              key={i}
              style={{ animationDelay: `${i * 180}ms` }}
            >
              <FileSearch size={20} />
              <i />
              <i />
            </span>
          ))}
          <div className="scan-beam" />
        </div>
      )}
      <div
        className={`search-meter ${run.phase === "discovering" ? "is-discovering" : ""}`}
        role="progressbar"
        aria-label="Sources processed"
        aria-valuemin={0}
        aria-valuemax={run.sources.length || 1}
        aria-valuenow={run.phase === "discovering" ? undefined : settled}
      >
        <span
          style={{
            width:
              run.phase === "discovering"
                ? "28%"
                : `${run.sources.length ? (settled / run.sources.length) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
