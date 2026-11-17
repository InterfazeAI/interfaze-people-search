"use client";
import { useEffect, useRef, useState } from "react";
import type { Contact, Expert } from "@/lib/schema";
import { findContactLinks } from "@/lib/contact-search";
import { errorMessage } from "@/lib/interfaze";

export interface ContactState {
  status: "loading" | "complete" | "error";
  contacts: Contact[];
  message: string;
}
export function useContactLinks() {
  const [records, setRecords] = useState<Record<string, ContactState>>({});
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );
  function reset() {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setRecords({});
  }
  async function find(expert: Expert, key: string) {
    if (active.current) return;
    const id = generation.current;
    const controller = new AbortController();
    active.current = controller;
    setRecords((current) => ({
      ...current,
      [expert.id]: {
        status: "loading",
        contacts: current[expert.id]?.contacts ?? [],
        message: "Checking public pages with Interfaze…",
      },
    }));
    try {
      const result = await findContactLinks(expert, key, controller.signal);
      if (id !== generation.current) return;
      setRecords((current) => ({
        ...current,
        [expert.id]: {
          status: "complete",
          contacts: result.contacts,
          message: result.contacts.length
            ? `${result.contacts.length} source-backed ${result.contacts.length === 1 ? "link" : "links"} found.`
            : result.pagesFailed
              ? "Some pages couldn’t be read. No additional links could be confirmed."
              : "No additional contact links could be confirmed from these pages.",
        },
      }));
    } catch (error) {
      if (id !== generation.current) return;
      setRecords((current) => ({
        ...current,
        [expert.id]: {
          status: "error",
          contacts: current[expert.id]?.contacts ?? [],
          message: controller.signal.aborted
            ? "Contact search stopped."
            : errorMessage(error),
        },
      }));
    } finally {
      if (id === generation.current) active.current = null;
    }
  }
  return {
    records,
    find,
    reset,
    busy: Object.values(records).some((r) => r.status === "loading"),
    cancel: () => active.current?.abort(),
  };
}
