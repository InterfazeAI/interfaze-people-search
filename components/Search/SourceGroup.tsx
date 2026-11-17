import { ArrowRight, ArrowUpRight, BookOpen, Fingerprint } from "lucide-react";
import type { Expert } from "@/lib/schema";
import type { ResultGroup } from "@/lib/result-groups";
import { ContactLinks } from "./ContactLinks";

export function SourceGroup({
  group,
  index,
  onSelect,
}: {
  group: ResultGroup;
  index: number;
  onSelect: (expert: Expert, sourceId: string) => void;
}) {
  const { source, people } = group;
  const paper = source.kind === "paper";
  return (
    <article
      className="result-group"
      style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
    >
      <header className="result-group-header">
        <div className="result-group-meta">
          <span>
            {paper ? <BookOpen size={14} /> : <Fingerprint size={14} />}
            {paper ? "Research paper" : "Patent"}
          </span>
          {source.year && <span>{source.year}</span>}
          <span>{new URL(source.url).hostname}</span>
        </div>
        <h3>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title} <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </h3>
        {source.topicSummary && (
          <p className="result-group-summary">{source.topicSummary}</p>
        )}
        {source.topicQuote && (
          <details className="result-group-passage">
            <summary>Why this {paper ? "paper" : "patent"} matches</summary>
            <blockquote>{source.topicQuote}</blockquote>
          </details>
        )}
      </header>
      <div className="result-group-people">
        <div className="result-group-people-heading">
          <span>
            {people.length} matched{" "}
            {paper
              ? people.length === 1
                ? "author"
                : "authors"
              : people.length === 1
                ? "inventor"
                : "inventors"}
          </span>
          <span>Affiliations as published</span>
        </div>
        <ul className="group-people-list">
          {people.map(({ expert, evidence }) => (
            <li className="group-person" key={expert.id}>
              <div className="group-person-info">
                <h4>
                  <button
                    type="button"
                    onClick={() => onSelect(expert, source.sourceId)}
                    aria-label={`View evidence for ${expert.name} in ${source.title}`}
                  >
                    {expert.name}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </h4>
                <p>{evidence.affiliation || "Affiliation not listed"}</p>
              </div>
              <ContactLinks
                name={expert.name}
                contacts={expert.contacts ?? []}
              />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
