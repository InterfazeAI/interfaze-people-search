import {
  discover,
  readSource,
  extractPeople,
  InterfazeError,
  errorMessage,
} from "./interfaze";
import { groundExtraction, mergeExperts } from "./evidence";
import { selectCandidates, sourceUrl, kindFromUrl } from "./sources";
import {
  MAX_QUERY_LENGTH,
  type Candidate,
  type SearchConfig,
  type SearchRun,
  type SourceKind,
} from "./schema";

import { keylessRemaining } from "./keyless";

// Discovery returns a finite set; read + extract each selected source.
// No retries: a dropped or cancelled request may already have been billed.
export async function searchExperts(
  config: SearchConfig,
  key: string,
  signal: AbortSignal,
  publish: (run: SearchRun) => void,
) {
  if (config.query.trim().length < 8 || config.query.length > MAX_QUERY_LENGTH)
    throw new InterfazeError("Describe a topic in 8–600 characters.");
  if (
    config.sourceLimit !== undefined &&
    (!Number.isSafeInteger(config.sourceLimit) || config.sourceLimit < 1)
  )
    throw new InterfazeError(
      "Choose a positive whole number of sources, or leave it blank for all discovered sources.",
    );
  const directUrl = sourceUrl(config.query.trim());
  if (/^https?:\/\//i.test(config.query.trim()) && !directUrl)
    throw new InterfazeError(
      "Use a supported public paper or patent URL, or describe a research topic.",
    );
  if (
    directUrl &&
    config.scope !== "all" &&
    kindFromUrl(directUrl) !== config.scope
  )
    throw new InterfazeError(
      "This URL doesn’t match the selected source type. Choose All sources or the matching type.",
    );
  const available = key.trim() ? null : keylessRemaining();
  if (available !== null && available < (directUrl ? 2 : 3))
    throw new InterfazeError(
      "Not enough keyless requests remain for this search. Add your API key or wait for the quota reset.",
      429,
    );
  const stop = new AbortController();
  const combined = AbortSignal.any([signal, stop.signal]);
  let fatal: string | undefined;
  let run: SearchRun = {
    config,
    experts: [],
    sources: [],
    phase: "discovering",
    requests: 0,
    warnings: [],
    startedAt: new Date().toISOString(),
  };
  const emit = () =>
    publish({
      ...run,
      experts: [...run.experts],
      sources: run.sources.map((s) => ({ ...s })),
      warnings: [...run.warnings],
    });
  const count = () => {
    combined.throwIfAborted();
    run.requests++;
    emit();
  };
  emit();
  try {
    const keyless = !key.trim();
    const kinds: SourceKind[] =
      config.scope === "all" ? ["paper", "patent"] : [config.scope];
    const groups = directUrl
      ? [
          [
            {
              url: directUrl,
              title: new URL(directUrl).hostname,
              kind: kindFromUrl(directUrl),
            },
          ],
        ]
      : await (async () => {
          const groups: Candidate[][] = [];
          for (const kind of kinds) {
            combined.throwIfAborted();
            // Preserve enough of a known keyless allowance to read and extract a source.
            const available = key.trim() ? null : keylessRemaining();
            if (available !== null && groups.length && available < 3) {
              // Keep enough requests to read and extract a source.
              break;
            }
            groups.push(
              await (async () => {
                try {
                  count();
                  return await discover(config, kind, key, combined);
                } catch (error) {
                  if (error instanceof InterfazeError && error.stopsSearch) {
                    fatal = error.message;
                    stop.abort();
                  }
                  if (!combined.aborted)
                    run.warnings.push(
                      `${kind === "paper" ? "Paper" : "Patent"} discovery: ${errorMessage(error)}`,
                    );
                  return [];
                }
              })(),
            );
          }
          return groups;
        })();
    combined.throwIfAborted();
    const discovered = selectCandidates(
      groups,
      config.scope,
      config.sourceLimit ?? Infinity,
    );
    const remaining = keyless ? keylessRemaining() : null;
    // Spend the available keyless budget on complete source reads + extractions.
    // Additional contact discovery requires a user's key.
    const sourceBudget = keyless
      ? remaining === null
        ? 1
        : Math.floor(remaining / 2)
      : discovered.length;
    if (keyless && discovered.length && sourceBudget < 1)
      throw new InterfazeError(
        "The keyless allowance cannot cover a source read and extraction. Add a key or wait for the reset.",
        429,
      );
    const candidates = discovered.slice(0, sourceBudget);
    if (keyless)
      run.keylessPreview = {
        discoveredSources: discovered.length,
        selectedSources: candidates.length,
      };
    run.sources = candidates.map((c) => ({
      ...c,
      status: "queued",
      people: 0,
    }));
    run.phase = "reading";
    emit();
    let cursor = 0;
    let quotaStopped = false;
    async function worker() {
      while (!combined.aborted && cursor < candidates.length) {
        const remaining = key.trim() ? null : keylessRemaining();
        if (remaining !== null && remaining < 2) {
          quotaStopped = true;
          break;
        }
        const index = cursor++;
        const candidate = candidates[index];
        const record = run.sources[index];
        try {
          record.status = "reading";
          count();
          const texts = await readSource(candidate, key, combined);
          combined.throwIfAborted();
          record.texts = texts;
          record.status = "extracting";
          count();
          const extracted = await extractPeople(
            candidate,
            texts,
            directUrl
              ? "Identify the authors or inventors of this document and their published work."
              : config.query,
            key,
            combined,
          );
          combined.throwIfAborted();
          const people = groundExtraction(candidate, extracted, texts);
          record.status = people.length ? "complete" : "skipped";
          record.people = people.length;
          record.note = people.length
            ? undefined
            : "No relevant authors or inventors with valid source passages and matching names.";
          run.experts = mergeExperts(run.experts, people);
        } catch (error) {
          if (error instanceof InterfazeError && error.stopsSearch) {
            fatal = error.message;
            stop.abort();
          }
          record.status = "failed";
          record.note = combined.aborted
            ? "Stopped before this source finished."
            : errorMessage(error);
        }
        emit();
      }
    }
    await Promise.all(key.trim() ? [worker(), worker()] : [worker()]);
    if (quotaStopped) {
      run.warnings.push(
        "The keyless allowance changed while this search was running. Completed results are kept; add a key or wait for the reset to continue.",
      );
      for (const record of run.sources) {
        if (record.status === "queued") {
          record.status = "skipped";
          record.note = "Not read: keyless allowance reached.";
        }
      }
    }
    combined.throwIfAborted();
    run.phase = quotaStopped ? "cancelled" : "complete";
  } catch (error) {
    run.phase = fatal ? "error" : signal.aborted ? "cancelled" : "error";
    for (const source of run.sources) {
      if (source.status === "queued") {
        source.status = "skipped";
        source.note =
          "Not read: the search stopped before this source started.";
      }
    }
    if (fatal) run.warnings.push(fatal);
    else if (!signal.aborted) run.warnings.push(errorMessage(error));
  }
  run = { ...run, finishedAt: new Date().toISOString() };
  emit();
  return run;
}
