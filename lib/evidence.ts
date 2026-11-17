import type {
  Candidate,
  Evidence,
  Expert,
  Extraction,
  SourceText,
} from "./schema";
import { sourceIdentity } from "./sources";
import { groundContacts, mergeContacts } from "./contacts";

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function containsName(text: string, name: string) {
  const escaped = normalizeText(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    "u",
  ).test(normalizeText(text));
}

/** Require a literal byline/inventor passage and a separate literal topical passage. */
export function groundExtraction(
  candidate: Candidate,
  data: Extraction,
  texts: SourceText[],
): Expert[] {
  if (!data.relevant || data.kind !== candidate.kind) return [];
  const topic =
    data.topicPassageId === null ? undefined : texts[data.topicPassageId];
  if (!topic || topic.text.trim().length < 20) return [];
  const sourceId = sourceIdentity(candidate.url);
  const people: Expert[] = [];
  for (const person of data.people) {
    if (person.role !== (candidate.kind === "paper" ? "author" : "inventor"))
      continue;
    const identity = texts[person.identityPassageId];
    if (!identity || !containsName(identity.text, person.name)) continue;
    const affiliationSource =
      person.affiliationPassageId === null
        ? undefined
        : texts[person.affiliationPassageId];
    const affiliationMatched =
      person.affiliation &&
      affiliationSource &&
      normalizeText(affiliationSource.text).includes(
        normalizeText(person.affiliation),
      );
    // An assignee is not evidence of the inventor's employment.
    const affiliation =
      candidate.kind === "paper" && affiliationMatched
        ? person.affiliation
        : null;
    const evidence: Evidence = {
      sourceId,
      title: data.title || candidate.title,
      url: candidate.url,
      kind: candidate.kind,
      year: data.year,
      role: person.role,
      identityQuote: identity.text,
      identityPage: identity.page,
      topicQuote: topic.text,
      topicPage: topic.page,
      topicSummary: data.topicSummary,
      affiliation,
      affiliationQuote: affiliation ? affiliationSource!.text : null,
    };
    // Conservatively keep same-name people separate unless a source affiliation also matches.
    const id = `${normalizeText(person.name)}::${affiliation ? normalizeText(affiliation) : sourceId}`;
    people.push({
      id,
      name: person.name,
      affiliation,
      evidence: [evidence],
      contacts: groundContacts(
        person.name,
        person.contacts ?? [],
        texts,
        candidate.url,
        data.people.map((p) => p.name),
      ),
    });
  }
  return people;
}

export function mergeExperts(existing: Expert[], incoming: Expert[]): Expert[] {
  const map = new Map(
    existing.map((p) => [p.id, { ...p, evidence: [...p.evidence] }]),
  );
  for (const person of incoming) {
    const prior = map.get(person.id);
    if (!prior)
      map.set(person.id, { ...person, evidence: [...person.evidence] });
    else {
      prior.contacts = mergeContacts(
        prior.contacts ?? [],
        person.contacts ?? [],
      );
      for (const evidence of person.evidence) {
        if (!prior.evidence.some((e) => e.sourceId === evidence.sourceId))
          prior.evidence.push(evidence);
      }
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.evidence.length - a.evidence.length || a.name.localeCompare(b.name),
  );
}
