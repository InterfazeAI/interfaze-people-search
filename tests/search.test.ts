import { afterEach, describe, expect, it, vi } from "vitest";
import { searchExperts } from "@/lib/search";
import { exportResults } from "@/lib/export";
import type { SearchRun } from "@/lib/schema";

const url = "https://arxiv.org/abs/2401.12345";
const sourceText =
  "Authors: Alice Jones, Bob Smith. Our new attention mechanism reduces memory consumption during training. This is a sufficiently long source document.";
const extracted = {
  kind: "paper",
  relevant: true,
  title: "Efficient attention",
  year: 2024,
  topicSummary: "A memory-efficient method.",
  topicPassageId: 0,
  people: [
    {
      name: "Alice Jones",
      role: "author",
      identityPassageId: 0,
      affiliation: null,
      affiliationPassageId: null,
    },
  ],
};
const answer = (data: unknown) =>
  Response.json({
    choices: [
      { message: { content: JSON.stringify(data) }, finish_reason: "stop" },
    ],
  });
afterEach(() => vi.unstubAllGlobals());
describe("search lifecycle", () => {
  it.each(["attention researchers", url])(
    "requires a valid key before starting discovery or reading (%s)",
    async (query) => {
      const fetcher = vi.fn();
      const publish = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      for (const key of ["", "   ", "bad key"]) {
        await expect(
          searchExperts(
            { query, scope: "all" },
            key,
            new AbortController().signal,
            publish,
          ),
        ).rejects.toThrow(/key/i);
      }
      expect(fetcher).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, 2])(
    "reads all discovered sources or the user limit (%s), without a six-source cap",
    async (sourceLimit) => {
      const fetcher = vi.fn().mockImplementation(async (_url, options) => {
        const task = JSON.parse(options.body).messages[0].content;
        return task === "<task>web_search</task>"
          ? answer({
              result: Array.from({ length: 8 }, (_, i) => ({
                url: `https://arxiv.org/abs/2401.${12340 + i}`,
                title: `Paper ${i}`,
              })),
            })
          : task === "<task>scraper</task>"
            ? answer({ result: { text: sourceText } })
            : answer(extracted);
      });
      vi.stubGlobal("fetch", fetcher);
      const run = await searchExperts(
        { query: "attention researchers", scope: "paper", sourceLimit },
        "test-key",
        new AbortController().signal,
        () => {},
      );
      expect(run.sources).toHaveLength(sourceLimit ?? 8);
      expect(run.sources.every((s) => s.status === "complete")).toBe(true);
      expect(run.requests).toBe(1 + 2 * (sourceLimit ?? 8));
    },
  );

  it("takes real task-shaped responses through discovery, reading, grounding, and export", async () => {
    const fetcher = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      const system = body.messages[0].content;
      if (system === "<task>web_search</task>")
        return answer({ result: [{ url, title: "Efficient attention" }] });
      if (system === "<task>scraper</task>")
        return answer({ result: { content: sourceText } });
      return answer(extracted);
    });
    vi.stubGlobal("fetch", fetcher);
    const updates: SearchRun[] = [];
    const run = await searchExperts(
      { query: "efficient attention researchers", scope: "paper" },
      "never-export-this-key",
      new AbortController().signal,
      (next) => updates.push(next),
    );
    expect(run.phase).toBe("complete");
    expect(run.requests).toBe(3);
    expect(run.experts[0].name).toBe("Alice Jones");
    expect(run.sources[0].status).toBe("complete");
    expect(run.sources[0].texts?.[0].text).toBe(sourceText);
    expect(JSON.parse(exportResults(run)).sources[0]).not.toHaveProperty(
      "texts",
    );
    expect(updates.some((r) => r.sources[0]?.status === "extracting")).toBe(
      true,
    );
    expect(exportResults(run)).not.toContain("never-export-this-key");
    expect(JSON.parse(exportResults(run)).people[0].evidence[0].url).toBe(url);
  });
  it("reads a supported URL directly without discovery and exports contacts", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer({ result: { text: sourceText } }))
      .mockResolvedValueOnce(answer(extracted));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: url, scope: "paper" },
      "test-key",
      new AbortController().signal,
      () => {},
    );
    expect(run.phase).toBe("complete");
    expect(run.requests).toBe(2);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages[0].content).toBe(
      "<task>scraper</task>",
    );
    expect(JSON.parse(exportResults(run)).people[0].contacts).toEqual([]);
  });
  it("rejects a direct URL with a mismatched scope before spending a request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      searchExperts(
        { query: url, scope: "patent" },
        "test-key",
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow(/source type/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("stops on authentication failure without scheduling source reads", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "test-key",
      new AbortController().signal,
      () => {},
    );
    expect(run.phase).toBe("error");
    expect(run.requests).toBe(1);
    expect(run.warnings[0]).toContain("key");
  });
  it("cancels without starting extraction or discarding already returned state", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(async (_url, options) => {
      if (
        JSON.parse(options.body).messages[0].content ===
        "<task>web_search</task>"
      )
        return answer({ result: [{ url, title: "Efficient attention" }] });
      controller.abort();
      throw new DOMException("Cancelled", "AbortError");
    });
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "test-key",
      controller.signal,
      () => {},
    );
    expect(run.phase).toBe("cancelled");
    expect(run.requests).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("handles no sources without fabricating people or making extra calls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer({ result: [] })));
    const run = await searchExperts(
      { query: "unknown research topic", scope: "paper" },
      "test-key",
      new AbortController().signal,
      () => {},
    );
    expect(run.phase).toBe("complete");
    expect(run.experts).toEqual([]);
    expect(run.requests).toBe(1);
  });
});
