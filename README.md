# Interfaze People Search

**Find the people behind the work.** Discover researchers and inventors through public papers and patents, with source evidence you can open.

An open-source application with keyless access and optional API keys powered **only by Interfaze’s API**. Built with Next.js, React, TypeScript, and Chakra UI. The typography, theme, and key-management pattern follow Interfaze’s Document Atlas project.

## Run locally

Requires Node.js **22.13+ (22.x)** and **pnpm 12.11.2**.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Search immediately without a key, or choose **Add API key** to use your [Interfaze account](https://interfaze.ai/dashboard). No `.env`, backend, database, or other API account is required.

1. Describe a topic or research problem, choose a suggested search, or paste a supported public paper/patent URL to inspect that document directly.
2. Select **All sources**, **Papers**, or **Patents**, then **Find experts**. Cmd/Ctrl + Enter also submits.
3. Results arrive grouped by paper or patent, with one shared summary and compact author rows showing affiliations and available contact icons. Choose a person to inspect their evidence, with that document shown first.
4. **Find passage in source** opens an in-app source pane and glides to the highlighted passage in retained Interfaze text. It uses no additional API request. Desktop shows source and evidence side by side; narrow screens show the source with a close/back control. **Open original** is an optional external link. This text view does not reproduce original HTML/PDF layout or invent OCR bounding boxes.
5. Email, LinkedIn, X, GitHub, and personal-website icons appear when supported by an individual author’s source passage. Open the evidence dialog for contact provenance, or choose **Find contact links** to check additional public pages using Interfaze. Ambiguous contact assignments are omitted.
6. Inspect the **Search details** for completed, skipped, and failed documents. Export people and evidence as JSON from that panel.

Searches always use live Interfaze responses. Progress reflects actual document states; animations respect reduced-motion preferences.

## What a search does

```text
Your question
  → Interfaze web_search task (papers and/or patents)
  → Eligible publisher URLs, deduplicated; optional user-selected source count
  → Interfaze scraper task for webpages / ocr task for PDFs
  → Interfaze structured extraction from returned source text
  → Validate passage IDs and names, then group identities
  → People + clickable evidence + source trail
```

- A direct document URL bypasses discovery and uses two calls (read + extract).
- Optional **Find contact links** uses at most seven additional calls per person: one search, up to three page reads, and up to three structured extractions. It requires the full name and a known paper title or source affiliation on a fetched page; search snippets alone are not accepted. Each lookup has a two-minute overall timeout. Additional contact searches require your own Interfaze key and use your account (with usage charges). Published contact links found during paper/patent extraction remain available in keyless results. Contact-search cancellation and authentication/credit/rate errors stop additional calls. Main-search request counts do not include these optional lookups.
- Uses model `interfaze-1` for every request. Keyed requests go only to `POST https://api.interfaze.ai/v1/chat/completions`. Keyless requests go to the supplied Interfaze deployment at `POST https://interfaze-7y9k3mak1-jigsaw-stack.vercel.app/v1/chat/completions` without an Authorization header. Keys are never sent to the keyless endpoint; failed keyed requests never silently fall back.
- Discovery and reading use the documented `<task>web_search</task>`, `<task>scraper</task>`, and `<task>ocr</task>` system prompts. Task results are read from `message.content` or `precontext`.
- Extraction uses a Zod-derived JSON schema and `x-interfaze-bypass-moa: true` so it works only on the supplied source text. No second LLM provider, search API, or embedding service.
- Keyed searches process all eligible sources returned by discovery by default, with no six-source cap. **Search options → Sources to read** sets an optional positive whole-number limit. Discovery returns a finite result set; this is not exhaustive web crawling or unlimited provider usage. A search uses 1–2 discovery calls plus up to 2 calls per selected source. Up to two keyed sources are processed concurrently; account rate limits and billing still apply.
- Keyless requests use the endpoint’s `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` headers. The live endpoint reported 10 requests and a reset approximately 24 hours later when checked on November 17, 2026 (Asia/Kolkata); the app does not hard-code this quota or infer its identity scope. Interfaze remains authoritative across tabs and devices. The keyless notice stays hidden during normal use and appears only when the endpoint reports zero requests remaining (including a 429). It offers adding a key and shows the reset time when available; the notice hides again after the reset or when a key is added.
- Keyless search plans a complete preview before queueing sources. It allocates all remaining requests to source reading and extraction, at two requests per source, with no contact-lookup reserve. Only selected sources enter progress and Search details; completing this smaller scope is a successful search. With a fresh ten-request allowance and enough eligible results, mixed discovery uses two requests and reads four documents (ten requests total); single-type discovery uses one request and reads four documents (nine requests total). The remaining single request cannot complete another document. With no quota headers, the preview conservatively selects one source. Additional contact discovery requires a user-supplied key; contacts present in source documents are still extracted for everyone.
- A genuinely exhausted or unexpectedly changed allowance still stops requests honestly, retaining completed results. No retries or quota bypasses are performed. Header state is held in memory and refreshed from the next API response after reload. A preview does not guarantee a relevant person or a contact link; sources must still pass evidence validation.
- Source text is capped at 100,000 characters per document; extraction returns at most 10 people per source. Large documents can be only partially inspected.
- Each API request has a 280-second client timeout. Keep this tab open during a search.
- Stop cancels active fetches and prevents new calls, retaining completed results. Cancellation does not guarantee cancellation of provider-side processing or billing. There are **no automatic retries**.
- Key, credit, and rate-limit errors stop the run. Other source failures are isolated so remaining documents can finish.

Official references: [API](https://interfaze.ai/docs/api/chat-completion), [tasks](https://interfaze.ai/docs/run-tasks), [search](https://interfaze.ai/docs/web/web-search), [scraping](https://interfaze.ai/docs/web/web-scraping), [OCR](https://interfaze.ai/docs/vision/ocr), [structured output](https://interfaze.ai/docs/structured-output).

## Evidence and identity rules

A result is shown only when the extraction identifies a relevant paper/patent and both its **name-bearing passage** and its **topical passage** reference valid passages returned by Interfaze’s reader. The reader preserves structured author HTML, tag boundaries, entity decoding, and sibling metadata before the document budget is consumed. This avoids concatenated bylines such as `MadaanAffiliation` without weakening full-name checks. Link destinations are retained as plain-text annotations; source HTML is never rendered. The reader text is split into contiguous passages of at most 700 characters. Interfaze selects passage IDs; the app displays the source text directly, rather than asking the model to rewrite quotes. The full name must occur in the selected identity passage. Name matching normalizes Unicode, typography, case, and whitespace. Invalid IDs and absent names are rejected.

This ensures evidence comes **from Interfaze’s returned content**, not independent factual accuracy. The scraper/OCR can make mistakes. The model still interprets document type, relevance, authorship/inventorship, and publication year. Review the original source before relying on a result. Generated relevance summaries are presented separately from quoted evidence.

- Contact values must occur literally in returned source text, with the person’s full name in an individual supporting passage. When a model selects a nested email field, the app can resolve it to a source block containing both the exact email and full name. Shared bylines and conflicting coauthor emails are not assigned. Profile identity and contact ownership remain model interpretations, and contact availability is not guaranteed. Export format v2 includes contact provenance.
- Only authors of the paper and inventors of the patent are requested; cited researchers, examiners, and attorneys are excluded by the extraction instructions.
- A paper affiliation appears only with a selected passage containing the organization. It is historical, never presented as a current job. The model interprets the person-to-affiliation association.
- Patent assignees are never turned into an inventor’s employer.
- Same-name people are merged only when the normalized name and supported affiliation match, or they come from the same document. This deliberately favors separate records over speculative identity merges; it is not a universal identity-resolution system.
- Only explicit positive OCR page numbers become PDF page links. Section positions never become invented page numbers.
- Publisher URLs are allowlisted in `lib/sources.ts`. Paper versions and NeurIPS abstract/PDF variants are deduplicated. Mixed discovery alternates paper and patent candidates.

## Key handling and storage

- Your key is masked by default and saved in this tab’s `sessionStorage`. It survives refreshes; browser session restoration may retain it. **Remove key** clears it explicitly.
- If session storage is unavailable, the key remains in memory and Settings explains the limitation.
- The browser sends the key directly to the fixed Interfaze endpoint in the Authorization header, with cookies omitted, redirects rejected, and `x-interfaze-zdr: true` requested.
- The hosting server never receives the key or research requests. There is no server-side key or credential fallback, analytics, or telemetry integration.
- Search results and retained source text remain in memory and disappear on refresh. JSON export contains results and source evidence, never the key, full retained source text, or raw provider responses.
- Passage finding stays inside the app and highlights only an exact match in retained source text, including known page metadata. Original-source links remain available in a new tab with no referrer. Remote HTML is never rendered or embedded.
- Saving a key checks input format; the first search checks authentication with Interfaze.

## Project structure

```text
app/                          Static Next.js page, layout, responsive styles
components/Search/            Search form, document groups, author rows, evidence, settings
components/ui/                Shared Chakra provider and Interfaze mark
fonts/                        Self-hosted Lora / Geist Mono and their licenses
theme.ts                      Interfaze design tokens and Chakra recipes
hooks/useApiKey.ts             Session-only key state
hooks/useSearch.ts             Search lifecycle, cancellation, stale-run protection
lib/keyless.ts                 Provider-reported quota state
hooks/useKeylessQuota.ts       Reactive quota display and reset time
lib/interfaze.ts               Fixed-endpoint transport and task adapters
lib/search.ts                 Quota-aware discovery → reading → extraction pipeline
lib/schema.ts                 Shared runtime schemas and types
lib/evidence.ts               Passage validation and conservative person grouping
lib/result-groups.ts          Document grouping with source-specific affiliations
lib/sources.ts                Source policy, document identity, evidence links
lib/export.ts                 Explicit export allowlist
tests/                        Transport, grounding, lifecycle, optional live checks
```

## Verify

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Ordinary tests mock Interfaze at the transport boundary and never use a real key. To check the current provider contract with one paper and one patent:

```sh
pnpm test:live
```

The terminal prompts for a key without echoing it. This opt-in check incurs Interfaze usage. It writes successful provider responses and evidence into ignored `.local/` files for debugging; the key is never written there. Do not publish these local captures. CI skips the live test.

## Deploy

This is a static Next.js export. Build and serve `out/` on Vercel or another static host:

```sh
pnpm build
pnpm start
```

For Vercel, import your repository using **Other** as the framework preset. `vercel.json` declares the install/build commands, `out` output directory, and security headers. Use Node 22.x and no environment variables. Visitors can use keyless access or add their own key. The browser requires Interfaze’s CORS support; test it from your deployment origin.

The production Content Security Policy limits network connections to the app origin, `https://api.interfaze.ai`, and the Interfaze keyless deployment listed above. Self-hosted fonts avoid a third-party font service. Apply the same headers on other hosts. Webpack is used for compatibility with the shared Chakra/Emotion setup.

## MVP scope

Focused, live discovery across selected public academic/patent publishers. This is not an exhaustive index of millions of documents, a contact database, or a guarantee of expertise. There is no crawling backend, saved-history service, email enrichment, outreach, or current-employment inference.

MIT licensed. Shared UI foundations retain Document Atlas attribution. Font licenses are in `fonts/`.
