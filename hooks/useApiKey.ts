"use client";

import { useSyncExternalStore } from "react";
import { API_KEY_SESSION_STORAGE, normalizeApiKey } from "@/lib/api-key";

type KeyState = { apiKey: string; storageError: string };
const empty: KeyState = { apiKey: "", storageError: "" };
const unavailable =
  "Session storage is unavailable. Your key will last until this page reloads.";
const listeners = new Set<() => void>();
let current: KeyState | undefined;

function getSnapshot(): KeyState {
  if (!current) {
    try {
      current = {
        apiKey:
          normalizeApiKey(
            sessionStorage.getItem(API_KEY_SESSION_STORAGE) ?? "",
          ) ?? "",
        storageError: "",
      };
    } catch {
      current = { apiKey: "", storageError: unavailable };
    }
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function save(value: string) {
  const apiKey = normalizeApiKey(value) ?? "";
  let storageError = "";
  try {
    if (apiKey) sessionStorage.setItem(API_KEY_SESSION_STORAGE, apiKey);
    else sessionStorage.removeItem(API_KEY_SESSION_STORAGE);
  } catch {
    storageError =
      "Could not update session storage. This page uses your change, but reloading may restore an earlier key.";
  }
  current = { apiKey, storageError };
  listeners.forEach((listener) => listener());
}

export function useApiKey() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => empty);
  return { ...state, save };
}
