import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { discover, readSource, extractPeople } from "@/lib/interfaze";
import { groundExtraction } from "@/lib/evidence";
import { selectCandidates } from "@/lib/sources";
import type { SourceKind } from "@/lib/schema";

// Opt-in only. Ordinary tests and CI never require or spend an API key.
describe.skipIf(!process.env.INTERFAZE_LIVE_KEY)(
  "live Interfaze contract",
  () => {
    it("discovers and grounds one paper and one patent using only Interfaze", async () => {
      const key = process.env.INTERFAZE_LIVE_KEY!;
      const originalFetch = globalThis.fetch;
      let request = 0;
      vi.stubGlobal("fetch", async (...args: Parameters<typeof fetch>) => {
        const result = await originalFetch(...args);
        if (result.ok) {
          mkdirSync(".local", { recursive: true });
          writeFileSync(
            `.local/live-response-${++request}.json`,
            JSON.stringify(await result.clone().json(), null, 2),
            { mode: 0o600 },
          );
        }
        return result;
      });
      const summary = [];
      for (const kind of ["paper", "patent"] as SourceKind[]) {
        const query =
          kind === "paper"
            ? "FlashAttention IO-aware exact attention Tri Dao"
            : "lithium ion battery recycling lithium recovery inventors";
        const config = { query, scope: kind };
        const signal = AbortSignal.timeout(500_000);
        const found = await discover(config, kind, key, signal);
        const selected = selectCandidates([found], kind, 1);
        expect(
          selected.length,
          `${kind}: discovery returned no eligible sources`,
        ).toBe(1);
        const texts = await readSource(selected[0], key, signal);
        const extracted = await extractPeople(
          selected[0],
          texts,
          query,
          key,
          signal,
        );
        const people = groundExtraction(selected[0], extracted, texts);
        summary.push({
          kind,
          source: selected[0],
          textCharacters: texts.reduce((n, t) => n + t.text.length, 0),
          extracted,
          people,
          texts,
        });
        mkdirSync(".local", { recursive: true });
        writeFileSync(
          ".local/live-check.json",
          JSON.stringify(summary, null, 2),
          { mode: 0o600 },
        );
        expect(
          people.length,
          `${kind}: no people survived evidence matching; inspect ignored .local/live-check.json`,
        ).toBeGreaterThan(0);
        console.log(
          `${kind}: ${found.length} candidates, ${people.length} people with matched evidence`,
        );
      }
    }, 600_000);
  },
);
