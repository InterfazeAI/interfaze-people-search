"use client";
import { useEffect, useRef, useState } from "react";
import { searchExperts } from "@/lib/search";
import { errorMessage } from "@/lib/interfaze";
import type { SearchConfig, SearchRun } from "@/lib/schema";

export function useSearch() {
  const [run, setRun] = useState<SearchRun | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = run?.phase === "discovering" || run?.phase === "reading";
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function start(config: SearchConfig, key: string) {
    controller.current?.abort();
    const id = ++generation.current;
    const active = new AbortController();
    controller.current = active;
    setError("");
    try {
      await searchExperts(config, key, active.signal, (next) => {
        if (generation.current === id) setRun(next);
      });
    } catch (cause) {
      if (generation.current === id) setError(errorMessage(cause));
    }
  }
  function reset() {
    generation.current++;
    controller.current?.abort();
    setRun(null);
    setError("");
  }
  return {
    run,
    error,
    busy,
    start,
    reset,
    cancel: () => controller.current?.abort(),
  };
}
