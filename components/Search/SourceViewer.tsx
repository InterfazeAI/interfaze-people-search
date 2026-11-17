"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  FileText,
  ScanSearch,
  X,
} from "lucide-react";
import type { SourceText } from "@/lib/schema";
import { findSourcePassage } from "@/lib/passage-view";
import { evidenceLink } from "@/lib/sources";

/** Atlas-style source reveal, using the source text already read for this search. */
export function SourceViewer({
  title,
  url,
  texts,
  quote,
  page,
  onClose,
}: {
  title: string;
  url: string;
  texts: SourceText[];
  quote: string;
  page: number | null;
  onClose: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const match = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const index = findSourcePassage(texts, quote, page);

  const locate = useCallback((animate = true) => {
    const view = viewport.current;
    const target = match.current;
    if (!view || !target) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const top =
      target.getBoundingClientRect().top -
      view.getBoundingClientRect().top +
      view.scrollTop;
    view.scrollTo({
      top: Math.max(
        0,
        top - Math.max(24, (view.clientHeight - target.clientHeight) / 2),
      ),
      behavior: animate && !reduced ? "smooth" : "instant",
    });
  }, []);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // First reveal the source, then glide to the passage, as in Document Atlas.
    const timer = setTimeout(() => locate(!reduced), reduced ? 0 : 420);
    return () => clearTimeout(timer);
  }, [locate]);

  return (
    <aside
      className="source-pane"
      id="source-reader"
      aria-label="Passage in source text"
    >
      <header className="source-pane-header">
        <span className="eyebrow">
          <FileText size={14} /> SOURCE TEXT
        </span>
        <div className="source-pane-tools">
          {index >= 0 && (
            <button
              type="button"
              onClick={() => locate()}
              aria-label="Find highlighted passage"
              title="Find highlighted passage"
            >
              <ScanSearch size={16} />
            </button>
          )}
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close source view"
          >
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="source-pane-title">
        <h3>{title}</h3>
        <a
          href={evidenceLink(url, quote, page)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original <ArrowUpRight size={12} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <div
        className="source-text-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="Scrollable source text"
      >
        {index < 0 ? (
          <p className="source-unavailable">
            {texts.length
              ? "This passage could not be located in the retained source text. Open the original to review it."
              : "Source text is unavailable for this result. Run the search again to enable the in-app source view, or open the original."}
          </p>
        ) : (
          <div className="source-text-sheet">
            {texts.map((text, i) => (
              <div
                className={`source-text-block ${i === index ? "is-match" : ""}`}
                key={i}
              >
                {text.page !== null &&
                  (i === 0 || texts[i - 1].page !== text.page) && (
                    <span className="source-page-label">Page {text.page}</span>
                  )}
                {i === index ? (
                  <mark ref={match} className="source-text-match">
                    {text.text}
                  </mark>
                ) : (
                  <p>{text.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="source-pane-footer">
        <span role="status">
          {index >= 0 ? (
            <>
              <Check size={14} /> Passage found
              {texts[index].page ? ` · page ${texts[index].page}` : ""}
            </>
          ) : (
            <>
              <CircleAlert size={14} /> Passage unavailable
            </>
          )}
        </span>
        <p>
          Text returned by Interfaze · original document layout is not shown.
        </p>
      </footer>
    </aside>
  );
}
