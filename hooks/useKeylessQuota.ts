"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getKeylessQuota,
  subscribeKeylessQuota,
  unknownQuota,
} from "@/lib/keyless";
export function useKeylessQuota() {
  const quota = useSyncExternalStore(
    subscribeKeylessQuota,
    getKeylessQuota,
    () => unknownQuota,
  );
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!quota.resetAt) return;
    const delay = Math.max(0, quota.resetAt - Date.now());
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [quota]);
  return quota.resetAt && now >= quota.resetAt ? unknownQuota : quota;
}
