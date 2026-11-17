import { describe, expect, it } from "vitest";
import { containsName, groundExtraction, mergeExperts } from "@/lib/evidence";
import {
  evidenceLink,
  isPdfSource,
  selectCandidates,
  sourceUrl,
} from "@/lib/sources";
import type { Candidate, Extraction } from "@/lib/schema";

const candidate: Candidate = {
  url: "https://arxiv.org/abs/2401.12345",
  title: "Memory research",
  kind: "paper",
};
const extraction: Extraction = {
  kind: "paper",
  relevant: true,
  title: "Memory research",
  year: 2024,
  topicSummary: "Memory-efficient attention.",
  topicPassageId: 1,
  people: [
    {
      name: "Alex Chen",
      role: "author",
      identityPassageId: 0,
      affiliation: null,
      affiliationPassageId: null,
    },
  ],
};
const texts = [
  { text: "Authors: Alex Chen, Mira Rao", page: 2 },
  {
    text: "Our attention method reduces the memory required during training.",
    page: 2,
  },
];

describe("evidence grounding", () => {
  it("materializes evidence directly from the selected passages", () => {
    const people = groundExtraction(candidate, extraction, texts);
    expect(people).toHaveLength(1);
    expect(people[0].evidence[0].identityPage).toBe(2);
    expect(people[0].evidence[0].identityQuote).toBe(texts[0].text);
    expect(people[0].evidence[0].topicQuote).toBe(texts[1].text);
  });
  it("rejects invented passage IDs or names not in the selected identity passage", () => {
    expect(
      groundExtraction(candidate, { ...extraction, topicPassageId: 99 }, texts),
    ).toEqual([]);
    expect(
      groundExtraction(
        candidate,
        { ...extraction, topicPassageId: null },
        texts,
      ),
    ).toEqual([]);
    expect(
      groundExtraction(
        candidate,
        {
          ...extraction,
          people: [{ ...extraction.people[0], identityPassageId: 1 }],
        },
        texts,
      ),
    ).toEqual([]);
    expect(
      groundExtraction(
        candidate,
        {
          ...extraction,
          people: [{ ...extraction.people[0], name: "Imaginary Person" }],
        },
        texts,
      ),
    ).toEqual([]);
  });
  it("preserves column interruptions and numeric punctuation rather than rewriting a quote", () => {
    const topic =
      "Lithium ion batter-\n(30) Foreign application priority data\nies are recycled with 4.2 percent loss.";
    const result = groundExtraction(candidate, extraction, [
      texts[0],
      { text: topic, page: 1 },
    ]);
    expect(result[0].evidence[0].topicQuote).toBe(topic);
  });
  it("accepts short full names but rejects substring matches", () => {
    expect(containsName("Joanne Lee", "Ann Lee")).toBe(false);
    const data = {
      ...extraction,
      people: [{ ...extraction.people[0], name: "Dan Fu" }],
    };
    expect(
      groundExtraction(candidate, data, [
        { text: "Dan Fu", page: null, field: "authors" },
        texts[1],
      ])[0].name,
    ).toBe("Dan Fu");
  });
  it("does not invent missing page numbers", () => {
    const result = groundExtraction(
      candidate,
      extraction,
      texts.map((t) => ({ ...t, page: null })),
    );
    expect(result[0].evidence[0].identityPage).toBeNull();
  });
  it("rejects irrelevant sources and role mismatches", () => {
    expect(
      groundExtraction(candidate, { ...extraction, relevant: false }, texts),
    ).toEqual([]);
    expect(
      groundExtraction(
        candidate,
        {
          ...extraction,
          people: [{ ...extraction.people[0], role: "inventor" }],
        },
        texts,
      ),
    ).toEqual([]);
  });
  it("never turns patent assignees into an inventor's employer", () => {
    const result = groundExtraction(
      {
        ...candidate,
        kind: "patent",
        url: "https://patents.google.com/patent/US123A/en",
      },
      {
        ...extraction,
        kind: "patent",
        people: [
          {
            ...extraction.people[0],
            role: "inventor",
            affiliation: "Acme",
            affiliationPassageId: 2,
          },
        ],
      },
      [...texts, { text: "Original Assignee: Acme Corporation", page: null }],
    );
    expect(result[0].affiliation).toBeNull();
  });
  it("drops an affiliation unless its selected source contains the organization", () => {
    const result = groundExtraction(
      candidate,
      {
        ...extraction,
        people: [
          {
            ...extraction.people[0],
            affiliation: "Acme",
            affiliationPassageId: 1,
          },
        ],
      },
      texts,
    );
    expect(result[0].affiliation).toBeNull();
  });
  it("keeps unsupported same-name identities separate across documents", () => {
    const first = groundExtraction(candidate, extraction, texts);
    const second = groundExtraction(
      { ...candidate, url: "https://arxiv.org/abs/2401.54321" },
      extraction,
      texts,
    );
    expect(mergeExperts(first, second)).toHaveLength(2);
    expect(mergeExperts(first, first)[0].evidence).toHaveLength(1);
  });
});

describe("source URLs", () => {
  it("recognizes extensionless USPTO PDFs", () => {
    const url =
      "https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12312654";
    expect(isPdfSource(url)).toBe(true);
    expect(evidenceLink(url, "Inventors", 1)).toBe(`${url}#page=1`);
  });
  it("rejects unsafe schemes, credentials, lookalike hosts, and search pages", () => {
    for (const value of [
      "javascript:alert(1)",
      "http://arxiv.org/abs/123",
      "https://arxiv.org.evil.test/abs/123",
      "https://secret@arxiv.org/abs/123",
      "https://arxiv.org/search/?q=test",
      "https://localhost/private",
    ])
      expect(sourceUrl(value)).toBeNull();
  });
  it("deduplicates paper versions and balances source types", () => {
    const papers: Candidate[] = [
      candidate,
      { ...candidate, url: "https://arxiv.org/pdf/2401.12345v2.pdf" },
    ];
    const patents: Candidate[] = [
      {
        title: "Patent",
        kind: "patent",
        url: "https://patents.google.com/patent/US123A/en",
      },
    ];
    expect(
      selectCandidates([papers, patents], "all", 6).map((s) => s.kind),
    ).toEqual(["paper", "patent"]);
    expect(selectCandidates([papers, patents], "paper", 6)).toHaveLength(1);
  });
  it("only links PDF pages when explicit and escapes text fragments", () => {
    expect(
      evidenceLink("https://arxiv.org/pdf/2401.12345", "Some quote here", null),
    ).not.toContain("#");
    expect(
      evidenceLink("https://arxiv.org/pdf/2401.12345", "Some quote here", 3),
    ).toContain("#page=3");
    expect(evidenceLink(candidate.url, "Memory-efficient", null)).toContain(
      "#:~:text=Memory%2Defficient",
    );
  });
});
