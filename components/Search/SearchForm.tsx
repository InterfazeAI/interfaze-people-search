"use client";
import { useKeylessQuota } from "@/hooks/useKeylessQuota";
import { useState } from "react";
import { Button } from "@chakra-ui/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Fingerprint,
  Search,
  Square,
} from "lucide-react";
import {
  MAX_QUERY_LENGTH,
  type SearchConfig,
  type SearchScope,
} from "@/lib/schema";

const examples: {
  title: string;
  query: string;
  scope: SearchScope;
}[] = [
  {
    title: "Agentic reasoning",
    query:
      "Researchers working on reasoning, planning, and tool use in large language model agents",
    scope: "paper",
  },
  {
    title: "World models",
    query:
      "Researchers building world models for action-conditioned video prediction and planning",
    scope: "paper",
  },
  {
    title: "LLM interpretability",
    query:
      "Researchers working on mechanistic interpretability of language models using sparse autoencoders and circuit tracing",
    scope: "paper",
  },
];
export function SearchForm({
  busy,
  hasKey,
  showExamples,
  onSearch,
  onCancel,
  onSettings,
}: {
  busy: boolean;
  hasKey: boolean;
  showExamples: boolean;
  onSearch: (config: SearchConfig) => void;
  onCancel: () => void;
  onSettings: () => void;
}) {
  const quota = useKeylessQuota();
  const [query, setQuery] = useState("");
  const [sourceLimit, setSourceLimit] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [error, setError] = useState("");
  return (
    <section aria-label="Expert search" className="search-area">
      <form
        className="search-box"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if (query.trim().length < 8) {
            setError("Add a little more detail—at least 8 characters.");
            return;
          }
          setError("");
          const limit = sourceLimit.trim() ? Number(sourceLimit) : undefined;
          if (
            hasKey &&
            limit !== undefined &&
            (!Number.isSafeInteger(limit) || limit < 1)
          ) {
            setError(
              "Choose a positive whole number of sources, or leave it blank for all.",
            );
            return;
          }
          onSearch({
            query: query.trim(),
            scope,
            ...(hasKey && limit !== undefined ? { sourceLimit: limit } : {}),
          });
        }}
      >
        <label htmlFor="search-query" className="search-label">
          <Search size={17} />
          <span>Who are you looking for?</span>
          {query.length > MAX_QUERY_LENGTH - 100 && (
            <span className="query-count">
              {query.length}/{MAX_QUERY_LENGTH}
            </span>
          )}
        </label>
        <textarea
          id="search-query"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          placeholder="Find researchers working on reasoning and tool-use agents…"
          maxLength={MAX_QUERY_LENGTH}
          rows={2}
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? "query-error" : "search-hint"}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
              event.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="search-controls">
          <fieldset className="scope-control" disabled={busy}>
            <legend className="sr-only">Source types</legend>
            {(
              [
                ["all", "All sources"],
                ["paper", "Papers"],
                ["patent", "Patents"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} data-selected={scope === value}>
                <input
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                {value === "paper" ? (
                  <BookOpen size={13} />
                ) : value === "patent" ? (
                  <Fingerprint size={13} />
                ) : null}
                {label}
              </label>
            ))}
          </fieldset>
          {busy ? (
            <Button
              variant="outline"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onCancel();
              }}
            >
              <Square size={12} /> Stop search
            </Button>
          ) : (
            <Button type="submit" size="md" className="search-submit">
              Find experts <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" id="query-error" className="error-note">
          {error}
        </p>
      )}
      <div className="search-hint" id="search-hint">
        <span>Describe a topic or paste a paper URL.</span>
        {hasKey && <span>Your key · all discovered sources by default</span>}
      </div>
      {hasKey ? (
        <details className="search-options">
          <summary>Search options</summary>
          <label htmlFor="source-limit">
            Sources to read
            <input
              id="source-limit"
              type="number"
              min="1"
              step="1"
              placeholder="All"
              value={sourceLimit}
              disabled={busy}
              onChange={(event) => setSourceLimit(event.target.value)}
            />
          </label>
          <p>
            Leave blank to read every source returned by discovery. Each source
            uses up to two API requests; your account limits and usage charges
            apply.
          </p>
        </details>
      ) : quota.remaining === 0 ? (
        <div className="keyless-note" role="status">
          <div>
            <span>Keyless allowance used up</span>
            <p>
              {quota.resetAt
                ? `Resets ${new Date(quota.resetAt).toLocaleString()}. `
                : ""}
              Add your Interfaze key to keep searching, or wait for the
              allowance to reset.
            </p>
          </div>
          <div className="keyless-actions">
            <a
              className="keyless-signup"
              href="https://interfaze.ai/auth"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign up for Interfaze{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" onClick={onSettings}>
              Add a key
            </button>
          </div>
        </div>
      ) : null}
      {showExamples && (
        <div className="examples" aria-label="Suggested searches">
          <span>Try a topic</span>
          {examples.map((example) => (
            <button
              type="button"
              key={example.title}
              disabled={busy}
              onClick={() => {
                setQuery(example.query);
                setScope(example.scope);
                setError("");
                document.getElementById("search-query")?.focus();
              }}
            >
              {example.scope === "paper" ? (
                <BookOpen size={12} />
              ) : example.scope === "patent" ? (
                <Fingerprint size={12} />
              ) : (
                <Search size={12} />
              )}
              {example.title}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
