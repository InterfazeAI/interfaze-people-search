import { describe, expect, it } from "vitest";
import { groupResults } from "@/lib/result-groups";
import type { Evidence, Expert, SourceRecord } from "@/lib/schema";

const paper: Evidence = {
  sourceId: "arxiv:2411.14103",
  title: "Shared research",
  url: "https://arxiv.org/html/2411.14103v1",
  kind: "paper",
  year: 2024,
  role: "author",
  identityQuote: "Alice and Bob",
  identityPage: null,
  topicQuote: "Research on language models.",
  topicPage: null,
  topicSummary: "A shared summary.",
  affiliation: "University A",
  affiliationQuote: "University A",
};
const patent: Evidence = {
  ...paper,
  sourceId: "patent:US123456",
  url: "https://patents.google.com/patent/US123456/en",
  kind: "patent",
  role: "inventor",
  affiliation: "Company B",
};
const alice: Expert = {
  id: "alice",
  name: "Alice",
  affiliation: "University A",
  evidence: [paper, patent],
  contacts: [
    {
      kind: "email",
      href: "mailto:alice@example.org",
      label: "alice@example.org",
      sourceUrl: paper.url,
      quote: "alice@example.org",
      page: null,
    },
  ],
};
const bob: Expert = {
  id: "bob",
  name: "Bob",
  affiliation: "University C",
  evidence: [{ ...paper, affiliation: "University C" }],
};
const sources: SourceRecord[] = [patent, paper].map((source) => ({
  ...source,
  status: "complete",
  people: 2,
}));

describe("results grouped by document", () => {
  it("shows one shared document with distinct people and source-specific affiliations", () => {
    const groups = groupResults([alice, bob], sources);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.source.sourceId)).toEqual([
      patent.sourceId,
      paper.sourceId,
    ]);
    expect(
      groups[1].people.map(({ evidence }) => evidence.affiliation),
    ).toEqual(["University A", "University C"]);
    expect(groups[0].people[0].evidence.affiliation).toBe("Company B");
    expect(groups[1].source.topicSummary).toBe("A shared summary.");
    expect(groups[0].people[0].expert).toBe(alice);
    expect(groups[1].people[0].expert.contacts).toBe(alice.contacts);
    expect(alice.evidence).toEqual([paper, patent]);
  });
  it("filters documents without dropping a person's other evidence or contacts", () => {
    const groups = groupResults([alice, bob], sources, "patent");
    expect(groups).toHaveLength(1);
    expect(groups[0].people.map(({ expert }) => expert.id)).toEqual(["alice"]);
    expect(groups[0].people[0].expert.evidence).toHaveLength(2);
    expect(groupResults([bob], sources, "patent")).toEqual([]);
  });
  it("deduplicates membership by person id, not name", () => {
    const sameName = { ...bob, id: "another-bob" };
    const groups = groupResults([bob, bob, sameName], sources);
    expect(groups).toHaveLength(1);
    expect(groups[0].people.map(({ expert }) => expert.id)).toEqual([
      "bob",
      "another-bob",
    ]);
    expect(groupResults([], [])).toEqual([]);
  });
});
