import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_ENDPOINT,
  completion,
  discover,
  extractPeople,
  readSourceText,
  taskResult,
} from "@/lib/interfaze";
import { extractionSchema } from "@/lib/schema";

const signal = new AbortController().signal;
const response = (content: unknown) => ({
  choices: [
    { message: { content: JSON.stringify(content) }, finish_reason: "stop" },
  ],
});
afterEach(() => vi.unstubAllGlobals());
describe("Interfaze transport", () => {
  it.each(["", "   ", "bad key", "x".repeat(4097)])(
    "rejects missing or malformed credentials before making a request (%s)",
    async (key) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(completion({}, key, signal)).rejects.toThrow(/key/i);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("treats the live provider's no-results response as an empty discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          response({
            name: "web_search",
            result: { error: "No results found" },
          }),
        ),
      ),
    );
    expect(
      await discover(
        { query: "unknown paper topic", scope: "paper" },
        "paper",
        "test-key",
        signal,
      ),
    ).toEqual([]);
  });
  it("only sends keys to the fixed endpoint and requests zero data retention", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json(response({ result: [] })));
    vi.stubGlobal("fetch", fetcher);
    await discover(
      { query: "attention researchers", scope: "paper" },
      "paper",
      "test-key",
      signal,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(API_ENDPOINT);
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.headers["x-interfaze-zdr"]).toBe("true");
    expect(options.redirect).toBe("error");
    expect(options.credentials).toBe("omit");
    expect(options.body).not.toContain("test-key");
    expect(JSON.parse(options.body).messages[0].content).toBe(
      "<task>web_search</task>",
    );
  });
  it.each([401, 402, 403, 429, 500])(
    "returns safe errors without echoing the response body for %i",
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response("secret echoed API key", { status }));
      vi.stubGlobal("fetch", fetcher);
      await expect(completion({}, "test-key", signal)).rejects.toThrow(
        /Interfaze/,
      );
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it("rejects truncation and malformed provider responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: "{}" }, finish_reason: "length" }],
        }),
      ),
    );
    await expect(completion({}, "test-key", signal)).rejects.toThrow(
      /too long/,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ unexpected: true })),
    );
    await expect(completion({}, "test-key", signal)).rejects.toThrow(
      /unexpected/,
    );
  });
  it("does not retry dropped requests", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetcher);
    await expect(completion({}, "test-key", signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("extracts using the same provider with external tools bypassed", async () => {
    const data = {
      kind: "paper",
      relevant: false,
      title: "Example",
      year: null,
      topicSummary: "",
      topicPassageId: null,
      people: [],
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json(response(data)));
    vi.stubGlobal("fetch", fetcher);
    expect(
      await extractPeople(
        {
          url: "https://arxiv.org/abs/1234.5678",
          title: "Example",
          kind: "paper",
        },
        [{ text: "Source text", page: null }],
        "query",
        "test-key",
        signal,
      ),
    ).toEqual(extractionSchema.parse(data));
    expect(fetcher.mock.calls[0][1].headers["x-interfaze-bypass-moa"]).toBe(
      "true",
    );
  });
});
describe("raw task parsing", () => {
  it("preserves short names and field context from the live scraper shape", () => {
    const texts = readSourceText({
      scraped_content: {
        authors: ["Tri Dao", "Dan Fu"],
        abstract: ["An IO-aware attention method that reduces memory traffic."],
      },
    });
    expect(texts).toContainEqual({
      text: "Tri Dao",
      page: null,
      field: "authors",
    });
    expect(texts).toContainEqual({
      text: "Dan Fu",
      page: null,
      field: "authors",
    });
  });
  it("handles documented content and precontext wrappers", () => {
    expect(
      taskResult(response({ name: "web_search", result: [] }), "web_search"),
    ).toEqual([]);
    expect(
      taskResult(
        response({ output: { name: "web_search", result: [] } }),
        "web_search",
      ),
    ).toEqual([]);
    expect(
      taskResult(
        {
          ...response(null),
          precontext: [{ name: "scraper", result: "source text" }],
        },
        "scraper",
      ),
    ).toBe("source text");
  });
  it("retains explicit OCR pages and does not treat sections as page numbers", () => {
    expect(
      readSourceText({
        sections: [
          { page: 5, text: "Authors: Alice Jones" },
          { text: "A passage without page metadata." },
        ],
        extracted_text: "Duplicated full text",
      }),
    ).toEqual([
      { page: 5, text: "Authors: Alice Jones" },
      { page: null, text: "A passage without page metadata." },
    ]);
  });
  it("reads nested scraper payloads while dropping scripts and URLs", () => {
    const texts = readSourceText({
      url: "https://arxiv.org/abs/1234",
      data: [
        {
          content:
            "<script>fake authors</script><p>Authors: Alice Jones &amp; Bob Smith</p>",
        },
      ],
    });
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe("Authors: Alice Jones & Bob Smith");
  });
});
