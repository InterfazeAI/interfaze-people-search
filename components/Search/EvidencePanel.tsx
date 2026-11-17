"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@chakra-ui/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Fingerprint,
  X,
} from "lucide-react";
import type { Evidence, Expert, SourceRecord } from "@/lib/schema";
import type { ContactState } from "@/hooks/useContactLinks";
import { ContactLinks } from "./ContactLinks";
import { sourceIdentity } from "@/lib/sources";
import { SourceViewer } from "./SourceViewer";

export function EvidencePanel({
  expert,
  sources,
  onClose,
  hasKey,
  contactState,
  contactBusy = false,
  onFindContacts,
  onCancelContacts,
  preferredSourceId,
}: {
  expert: Expert;
  sources: SourceRecord[];
  onClose: () => void;
  hasKey: boolean;
  contactState?: ContactState;
  contactBusy?: boolean;
  onFindContacts?: () => void;
  onCancelContacts?: () => void;
  preferredSourceId?: string;
}) {
  const evidence = [...expert.evidence].sort(
    (a, b) =>
      Number(b.sourceId === preferredSourceId) -
      Number(a.sourceId === preferredSourceId),
  );
  const affiliation = evidence[0]?.affiliation;
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [shown, setShown] = useState<{
    evidence: Evidence;
    quote: string;
    page: number | null;
    kind: "identity" | "topic";
  } | null>(null);
  function closeSource() {
    setShown(null);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }
  function showPassage(
    evidence: Evidence,
    kind: "identity" | "topic",
    button: HTMLButtonElement,
  ) {
    if (shown?.evidence.sourceId === evidence.sourceId && shown.kind === kind) {
      closeSource();
      return;
    }
    opener.current = button;
    setShown({
      evidence,
      kind,
      quote: kind === "identity" ? evidence.identityQuote : evidence.topicQuote,
      page: kind === "identity" ? evidence.identityPage : evidence.topicPage,
    });
  }
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal evidence-modal ${shown ? "with-source" : ""}`}
      aria-labelledby="evidence-title"
      onCancel={(event) => {
        if (shown) {
          event.preventDefault();
          closeSource();
        } else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="evidence-layout">
        <div className="modal-inner evidence-content">
          <header className="modal-header">
            <span className="eyebrow">SOURCE EVIDENCE</span>
            <Button
              variant="ghost"
              onClick={onClose}
              aria-label="Close evidence"
            >
              <X />
            </Button>
          </header>
          <h2 id="evidence-title">{expert.name}</h2>
          <p className="modal-intro">
            {affiliation
              ? `${affiliation} · affiliation in source`
              : "Identified through their published work."}
          </p>
          <section
            className="person-contacts"
            aria-label="Connect with this person"
          >
            <div className="contacts-heading">
              <span className="field-label">Connect</span>
              {contactState?.status === "loading" ? (
                <Button variant="ghost" onClick={onCancelContacts}>
                  Stop
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={contactBusy || !onFindContacts}
                  onClick={onFindContacts}
                >
                  {!hasKey
                    ? "Add a key to find more"
                    : contactState
                      ? "Check again"
                      : "Find contact links"}
                </Button>
              )}
            </div>
            <ContactLinks
              name={expert.name}
              contacts={expert.contacts ?? []}
              detailed
            />
            {!expert.contacts?.length && (
              <p className="fine-print">
                No contact links found in the document.
              </p>
            )}
            <p className="fine-print">
              {hasKey
                ? "Checks up to 3 public pages using your Interfaze key. Only source-backed links are shown."
                : "Published contact links are included above when available. Add your Interfaze key to search for additional links."}
            </p>
            {contactState && (
              <p
                className={
                  contactState.status === "error"
                    ? "error-note"
                    : "contact-search-status"
                }
                role="status"
              >
                {contactState.message}
              </p>
            )}
          </section>
          {evidence.map((e, index) => (
            <section className="source-evidence" key={e.sourceId}>
              <div className="source-evidence-meta">
                <span>
                  {e.kind === "paper" ? (
                    <BookOpen size={14} />
                  ) : (
                    <Fingerprint size={14} />
                  )}
                  {e.kind === "paper" ? "RESEARCH PAPER" : "PATENT"}
                </span>
                <span>
                  {e.year || "Year unavailable"} /{" "}
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3>
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.title}
                  <ArrowUpRight size={15} />
                </a>
              </h3>
              <p className="source-domain">{new URL(e.url).hostname}</p>
              <div className="passage">
                <span className="field-label">
                  {e.role === "author" ? "Authorship" : "Inventorship"}
                </span>
                <blockquote>{e.identityQuote}</blockquote>
                <button
                  type="button"
                  className="text-link passage-button"
                  aria-expanded={
                    shown?.evidence.sourceId === e.sourceId &&
                    shown.kind === "identity"
                  }
                  aria-controls="source-reader"
                  onClick={(event) =>
                    showPassage(e, "identity", event.currentTarget)
                  }
                >
                  {e.identityPage
                    ? `Find passage on page ${e.identityPage}`
                    : "Find passage in source"}
                  <ArrowRight size={13} />
                </button>
              </div>
              <div className="passage">
                <span className="field-label">Why this topic matches</span>
                <blockquote>{e.topicQuote}</blockquote>
                <button
                  type="button"
                  className="text-link passage-button"
                  aria-expanded={
                    shown?.evidence.sourceId === e.sourceId &&
                    shown.kind === "topic"
                  }
                  aria-controls="source-reader"
                  onClick={(event) =>
                    showPassage(e, "topic", event.currentTarget)
                  }
                >
                  {e.topicPage
                    ? `Find passage on page ${e.topicPage}`
                    : "Find passage in source"}
                  <ArrowRight size={13} />
                </button>
              </div>
              {e.affiliationQuote && e.affiliationQuote !== e.identityQuote && (
                <div className="passage">
                  <span className="field-label">Affiliation in source</span>
                  <blockquote>{e.affiliationQuote}</blockquote>
                </div>
              )}
              <div className="matched-label">
                <Check size={13} />
                Passages selected directly from returned source text
              </div>
              {e.topicSummary && (
                <p className="fine-print">
                  <strong>Why it may fit:</strong> {e.topicSummary}
                </p>
              )}
            </section>
          ))}
          <p className="fine-print evidence-footnote">
            AI selects passages and interprets relevance and attribution. Review
            the original source; affiliations may be historical. The in-app view
            highlights retained source text, not the original page layout.
          </p>
        </div>
        {shown && (
          <SourceViewer
            key={`${shown.evidence.sourceId}:${shown.kind}`}
            title={shown.evidence.title}
            url={shown.evidence.url}
            texts={
              sources.find(
                (source) =>
                  sourceIdentity(source.url) === shown.evidence.sourceId,
              )?.texts ?? []
            }
            quote={shown.quote}
            page={shown.page}
            onClose={closeSource}
          />
        )}
      </div>
    </dialog>
  );
}
