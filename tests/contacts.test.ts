import { describe, expect, it, vi, afterEach } from "vitest";
import { readSourceText } from "@/lib/source-text";
import { containsName, groundExtraction } from "@/lib/evidence";
import { groundContacts, normalizeContact } from "@/lib/contacts";
import { findContactLinks } from "@/lib/contact-search";
import type { Candidate, Expert, Extraction } from "@/lib/schema";
import fixture from "./fixtures/arxiv-2411.14103-byline.json";

const names = [
  "Lovish Madaan",
  "David Esiobu",
  "Pontus Stenetorp",
  "Barbara Plank",
  "Dieuwke Hupkes",
];
const candidate: Candidate = {
  url: "https://arxiv.org/html/2411.14103v1",
  kind: "paper",
  title: "Lost in Inference",
};
afterEach(() => vi.unstubAllGlobals());
describe("arXiv author regression", () => {
  it("grounds all five authors from structured HTML without relaxing name boundaries", () => {
    const texts = readSourceText(fixture);
    const data: Extraction = {
      kind: "paper",
      relevant: true,
      title: candidate.title,
      year: 2024,
      topicSummary: "Natural language inference evaluation.",
      topicPassageId: texts.findIndex((t) => t.text.includes("In this paper")),
      people: names.map((name) => ({
        name,
        role: "author",
        identityPassageId: texts.findIndex((t) => containsName(t.text, name)),
        affiliation: null,
        affiliationPassageId: null,
      })),
    };
    expect(groundExtraction(candidate, data, texts).map((p) => p.name)).toEqual(
      names,
    );
    expect(containsName("Joanne Lee", "Ann Lee")).toBe(false);
    expect(containsName("Lovish MadaanAffiliation", "Lovish Madaan")).toBe(
      false,
    );
  });
  it("keeps bylines even when bulk body text exceeds the document budget", () => {
    const texts = readSourceText({
      ...fixture,
      scraped_content: { body: ["Body ".repeat(30000)] },
    });
    for (const name of names)
      expect(texts.some((t) => containsName(t.text, name))).toBe(true);
  });
  it("does not assign the misplaced coauthor email to David or a shared byline", () => {
    const texts = readSourceText(fixture);
    const david = texts.findIndex(
      (t) =>
        containsName(t.text, "David Esiobu") &&
        !containsName(t.text, "Lovish Madaan") &&
        t.text.includes("dieuwkehupkes@meta.com"),
    );
    expect(david).toBeGreaterThanOrEqual(0);
    expect(
      groundContacts(
        "David Esiobu",
        [{ kind: "email", value: "dieuwkehupkes@meta.com", passageId: david }],
        texts,
        candidate.url,
        names,
      ),
    ).toEqual([]);
    const lovish = texts.findIndex(
      (t) =>
        containsName(t.text, "Lovish Madaan") &&
        !containsName(t.text, "David Esiobu") &&
        t.text.includes("lovish@meta.com"),
    );
    expect(
      groundContacts(
        "Lovish Madaan",
        [{ kind: "email", value: "lovish@meta.com", passageId: lovish }],
        texts,
        candidate.url,
        names,
      )[0].href,
    ).toBe("mailto:lovish@meta.com");
  });
  it("retains sibling authors, HTML boundaries, entities, and link destinations", () => {
    const texts = readSourceText({
      text: "Document abstract that should not erase authors.",
      authors: [{ name: "Alice Jones", email: "alice@example.org" }],
    });
    expect(texts.some((t) => t.text.includes("Alice Jones"))).toBe(true);
    const html = readSourceText({
      html: '<span>Alice Jones</span><a href="https://www.linkedin.com/in/alice-jones">LinkedIn</a> &#233;',
      text: "Alice JonesLinkedIn é",
    });
    expect(html[0].text).toContain("Alice Jones");
    expect(html[0].text).toContain("https://www.linkedin.com/in/alice-jones");
    expect(html[0].text).toContain("é");
    expect(
      groundContacts(
        "Alice Jones",
        [
          {
            kind: "linkedin",
            value: "https://www.linkedin.com/in/alice-jones",
            passageId: 0,
          },
        ],
        html,
        candidate.url,
      ),
    ).toHaveLength(1);
  });
});
describe("contact validation", () => {
  it("rejects invented contacts, shared attribution, and unsafe destinations", () => {
    const texts = [{ text: "Alice Jones: alice@example.org", page: null }];
    expect(
      groundContacts(
        "Alice Jones",
        [{ kind: "email", value: "invented@example.org", passageId: 0 }],
        texts,
        candidate.url,
      ),
    ).toEqual([]);
    expect(
      groundContacts(
        "Bob Smith",
        [{ kind: "email", value: "alice@example.org", passageId: 0 }],
        texts,
        candidate.url,
      ),
    ).toEqual([]);
    for (const value of [
      "javascript:alert(1)",
      "https://linkedin.com.evil.org/in/alice",
      "https://linkedin.com/company/acme",
      "https://secret@linkedin.com/in/alice",
    ])
      expect(normalizeContact("linkedin", value)).toBeNull();
    expect(normalizeContact("x", "https://x.com/intent")).toBeNull();
    expect(
      normalizeContact(
        "website",
        "https://example.org/profile?id=42&utm_source=search",
      )?.href,
    ).toBe("https://example.org/profile?id=42");
    expect(
      normalizeContact("github", "https://github.com/alice/project"),
    ).toBeNull();
    expect(
      normalizeContact("email", "alice@example.org?bcc=other@example.org"),
    ).toBeNull();
    expect(normalizeContact("website", "https://127.0.0.1/private")).toBeNull();
    expect(normalizeContact("email", "alice%0a@example.org")?.href).toContain(
      "%250a",
    );
  });
  it("resolves a nested email passage to its source author block", () => {
    const texts = [
      { text: "Email: alice@example.org", page: null },
      { text: "Alice Jones Email: alice@example.org", page: null },
    ];
    expect(
      groundContacts(
        "Alice Jones",
        [{ kind: "email", value: "alice@example.org", passageId: 0 }],
        texts,
        candidate.url,
      )[0].quote,
    ).toBe(texts[1].text);
  });
  it("accepts individual public profile links with source provenance", () => {
    const texts = [{ text: "Alice Jones — https://x.com/alicejones", page: 1 }];
    expect(
      groundContacts(
        "Alice Jones",
        [{ kind: "x", value: "https://x.com/alicejones", passageId: 0 }],
        texts,
        candidate.url,
      )[0],
    ).toMatchObject({
      kind: "x",
      href: "https://x.com/alicejones",
      sourceUrl: candidate.url,
      page: 1,
      quote: texts[0].text,
    });
  });
  it("finds source-backed social links through Interfaze only", async () => {
    const answer = (data: unknown) =>
      Response.json({
        choices: [{ message: { content: JSON.stringify(data) } }],
      });
    const text =
      "Alice Jones at Research University. LinkedIn: https://linkedin.com/in/alice-jones";
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        answer({ result: [{ url: "https://example.org/alice" }] }),
      )
      .mockResolvedValueOnce(answer({ result: { text } }))
      .mockResolvedValueOnce(
        answer({
          samePerson: true,
          identityPassageId: 0,
          contextPassageId: 0,
          contacts: [
            {
              kind: "linkedin",
              value: "https://linkedin.com/in/alice-jones",
              passageId: 0,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const expert: Expert = {
      id: "alice",
      name: "Alice Jones",
      affiliation: "Research University",
      evidence: [],
    };
    const result = await findContactLinks(
      expert,
      "test-key",
      new AbortController().signal,
    );
    expect(result.contacts[0]).toMatchObject({
      href: "https://linkedin.com/in/alice-jones",
      sourceUrl: "https://example.org/alice",
      quote: text,
    });
    expect(
      fetcher.mock.calls.every(
        ([url]) => url === "https://api.interfaze.ai/v1/chat/completions",
      ),
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("stops contact enrichment on credit failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("do not echo", { status: 402 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      findContactLinks(
        { id: "alice", name: "Alice Jones", affiliation: null, evidence: [] },
        "test-key",
        new AbortController().signal,
      ),
    ).rejects.toThrow(/credits/);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("requires an API key for contact lookup without making requests", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      findContactLinks(
        { id: "alice", name: "Alice Jones", affiliation: null, evidence: [] },
        "",
        new AbortController().signal,
      ),
    ).rejects.toThrow(/API key/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not enrich a same-name profile without matching research context", async () => {
    const answer = (data: unknown) =>
      Response.json({
        choices: [{ message: { content: JSON.stringify({ result: data }) } }],
      });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer([{ url: "https://example.org/alice" }]))
      .mockResolvedValueOnce(
        answer({
          text: "Alice Jones, a different person. https://x.com/alicejones",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const expert: Expert = {
      id: "alice",
      name: "Alice Jones",
      affiliation: "Research University",
      evidence: [],
    };
    expect(
      (await findContactLinks(expert, "test-key", new AbortController().signal))
        .contacts,
    ).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
