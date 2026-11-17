import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ENDPOINT, KEYLESS_ENDPOINT, completion } from "@/lib/interfaze";
import {
  getKeylessQuota,
  keylessRemaining,
  updateKeylessQuota,
} from "@/lib/keyless";
import { searchExperts } from "@/lib/search";
import { findContactLinks } from "@/lib/contact-search";
const signal = new AbortController().signal;
const answer = (data: unknown, remaining?: number) =>
  Response.json(
    {
      choices: [
        { message: { content: JSON.stringify(data) }, finish_reason: "stop" },
      ],
    },
    {
      headers:
        remaining === undefined
          ? {}
          : {
              "X-RateLimit-Limit": "10",
              "X-RateLimit-Remaining": String(remaining),
              "X-RateLimit-Reset": String(
                Math.floor(Date.now() / 1000) + 86400,
              ),
            },
    },
  );
beforeEach(() => updateKeylessQuota(new Response()));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("keyless transport and quota", () => {
  it("uses only the keyless endpoint without credentials and reads official headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(answer("OK", 9));
    vi.stubGlobal("fetch", fetcher);
    await completion({}, "", signal);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(KEYLESS_ENDPOINT);
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
    expect(getKeylessQuota()).toMatchObject({ limit: 10, remaining: 9 });
  });
  it("never falls back from a rejected key to keyless", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("private error", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(completion({}, "test-key", signal)).rejects.toThrow(
      /rejected/,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(API_ENDPOINT);
  });
  it("rejects malformed nonempty keys instead of falling back", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(completion({}, "bad key", signal)).rejects.toThrow(/format/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("honors 429 and Retry-After without echoing responses or retrying", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
    const fetcher = vi.fn().mockResolvedValue(
      new Response("private payload", {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(completion({}, "", signal)).rejects.toThrow(/allowance/);
    await expect(completion({}, "", signal)).rejects.toThrow(/allowance/);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(keylessRemaining()).toBe(0);
    vi.advanceTimersByTime(60001);
    expect(keylessRemaining()).toBeNull();
  });
  it("does not invent a quota when headers are absent or malformed", () => {
    updateKeylessQuota(
      new Response(null, {
        headers: {
          "X-RateLimit-Limit": "invalid",
          "X-RateLimit-Remaining": "-1",
          "X-RateLimit-Reset": "bad",
        },
      }),
    );
    expect(getKeylessQuota()).toEqual({
      limit: null,
      remaining: null,
      resetAt: null,
    });
  });
  it("keeps keyed requests independent of an exhausted keyless allowance", async () => {
    updateKeylessQuota(answer("OK", 0));
    const fetcher = vi.fn().mockResolvedValue(answer("OK"));
    vi.stubGlobal("fetch", fetcher);
    await completion({}, "test-key", signal);
    expect(fetcher.mock.calls[0][0]).toBe(API_ENDPOINT);
    expect(keylessRemaining()).toBe(0);
  });
});
const paper = (i: number) => ({
  url: `https://arxiv.org/abs/2401.${12340 + i}`,
  title: `Paper ${i}`,
});
const extracted = {
  kind: "paper",
  relevant: true,
  title: "Attention",
  year: 2024,
  topicSummary: "Attention research.",
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
const source =
  "Authors: Alice Jones. This research paper studies attention mechanisms and memory use during language model training.";
describe("source selection and provider allowance", () => {
  it.each([undefined, 2])(
    "reads all discovered sources or the user limit (%s), without a six-source cap",
    async (sourceLimit) => {
      const fetcher = vi.fn().mockImplementation(async (_url, options) => {
        const task = JSON.parse(options.body).messages[0].content;
        return task === "<task>web_search</task>"
          ? answer({ result: Array.from({ length: 8 }, (_, i) => paper(i)) })
          : task === "<task>scraper</task>"
            ? answer({ result: { text: source } })
            : answer(extracted);
      });
      vi.stubGlobal("fetch", fetcher);
      const run = await searchExperts(
        { query: "attention researchers", scope: "paper", sourceLimit },
        "test-key",
        signal,
        () => {},
      );
      expect(run.sources).toHaveLength(sourceLimit ?? 8);
      expect(run.sources.every((s) => s.status === "complete")).toBe(true);
      expect(run.requests).toBe(1 + 2 * (sourceLimit ?? 8));
    },
  );
  it("plans a smaller complete preview without queueing unaffordable sources", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer({ result: [paper(1), paper(2)] }, 3))
      .mockResolvedValueOnce(answer({ result: { text: source } }, 2))
      .mockResolvedValueOnce(answer(extracted, 1));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "",
      signal,
      () => {},
    );
    expect(run.experts[0].name).toBe("Alice Jones");
    expect(run.sources.map((s) => s.status)).toEqual(["complete"]);
    expect(run.phase).toBe("complete");
    expect(run.warnings).toEqual([]);
    expect(run.keylessPreview).toEqual({
      discoveredSources: 2,
      selectedSources: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("does not spend a known insufficient allowance on discovery", async () => {
    updateKeylessQuota(answer("OK", 2));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      searchExperts(
        { query: "attention researchers", scope: "all" },
        "",
        signal,
        () => {},
      ),
    ).rejects.toThrow(/Not enough/);
    await expect(
      findContactLinks(
        { id: "a", name: "Alice Jones", affiliation: null, evidence: [] },
        "",
        signal,
      ),
    ).rejects.toThrow(/API key/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("stops on a keyless 429 without scheduling more sources", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer({ result: [paper(1), paper(2)] }, 9))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "",
      signal,
      () => {},
    );
    expect(run.phase).toBe("error");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(run.warnings.join(" ")).toContain("keyless");
  });

  it("requires a personal key for contact lookup without consuming keyless allowance", async () => {
    updateKeylessQuota(answer("OK", 10));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      findContactLinks(
        { id: "alice", name: "Alice Jones", affiliation: null, evidence: [] },
        "",
        signal,
      ),
    ).rejects.toThrow(/API key/);
    expect(fetcher).not.toHaveBeenCalled();
    expect(keylessRemaining()).toBe(10);
  });
  it.each([
    ["all", 10, 0],
    ["paper", 9, 1],
  ] as const)(
    "maximizes %s discovery within a fresh allowance",
    async (scope, requests, left) => {
      let remaining = 10;
      const fetcher = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        remaining--;
        if (body.messages[0].content === "<task>web_search</task>")
          return answer(
            { result: Array.from({ length: 8 }, (_, i) => paper(i)) },
            remaining,
          );
        if (body.messages[0].content === "<task>scraper</task>")
          return answer({ result: { text: source } }, remaining);
        return answer(extracted, remaining);
      });
      vi.stubGlobal("fetch", fetcher);
      const run = await searchExperts(
        { query: "attention researchers", scope },
        "",
        signal,
        () => {},
      );
      expect(run.phase).toBe("complete");
      expect(run.warnings).toEqual([]);
      expect(run.sources).toHaveLength(4);
      expect(run.sources.every((source) => source.status === "complete")).toBe(
        true,
      );
      expect(run.keylessPreview).toEqual({
        discoveredSources: 8,
        selectedSources: 4,
      });
      expect(run.requests).toBe(requests);
      expect(remaining).toBe(left);
      expect(fetcher).toHaveBeenCalledTimes(requests);
    },
  );
  it("uses one conservative source when quota headers are missing", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer({ result: [paper(1), paper(2)] }))
      .mockResolvedValueOnce(answer({ result: { text: source } }))
      .mockResolvedValueOnce(answer(extracted));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "",
      signal,
      () => {},
    );
    expect(run.phase).toBe("complete");
    expect(run.sources).toHaveLength(1);
    expect(run.warnings).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("reports unexpected quota changes without claiming the planned preview completed", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        answer({ result: [paper(1), paper(2), paper(3)] }, 9),
      )
      .mockResolvedValueOnce(answer({ result: { text: source } }, 2))
      .mockResolvedValueOnce(answer(extracted, 1));
    vi.stubGlobal("fetch", fetcher);
    const run = await searchExperts(
      { query: "attention researchers", scope: "paper" },
      "",
      signal,
      () => {},
    );
    expect(run.phase).toBe("cancelled");
    expect(run.experts).toHaveLength(1);
    expect(run.warnings.join(" ")).toContain("changed while");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
