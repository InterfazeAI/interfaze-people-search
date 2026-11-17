import type { z } from "zod";
import {
  contactSelectionSchema,
  type Contact,
  type Expert,
  type SourceText,
} from "./schema";
import { containsName, normalizeText } from "./evidence";

export function publicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !host.includes(".") ||
      /^(\d|\[)/.test(host) ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeContact(
  kind: Contact["kind"],
  value: string,
): Pick<Contact, "kind" | "href" | "label"> | null {
  const clean = value.trim();
  if (kind === "email") {
    const email = clean.replace(/^mailto:/i, "");
    if (
      email.length > 254 ||
      !/^[a-z\d.!#$%&'*+\/=^_`{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(
        email,
      )
    )
      return null;
    return {
      kind,
      href: `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`,
      label: email,
    };
  }
  const safe = publicUrl(clean);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/$/, "");
  const linkedin =
    host === "linkedin.com" && /^\/in\/[a-z\d_%.-]+$/i.test(path);
  const x =
    ["x.com", "twitter.com"].includes(host) &&
    /^\/[a-z\d_]{1,15}$/i.test(path) &&
    !/^\/(home|search|intent|share|explore|settings|login|signup|i)$/i.test(
      path,
    );
  const github =
    host === "github.com" &&
    /^\/[a-z\d-]+$/i.test(path) &&
    !/^\/(login|signup|features|topics|orgs|settings|search|explore)$/i.test(
      path,
    );
  if (
    (kind === "linkedin" && !linkedin) ||
    (kind === "x" && !x) ||
    (kind === "github" && !github)
  )
    return null;
  if (
    kind === "website" &&
    /(^|\.)(linkedin\.com|x\.com|twitter\.com|github\.com)$/.test(host)
  )
    return null;
  if (kind === "website") {
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["gclid", "fbclid"].includes(key))
        url.searchParams.delete(key);
    }
  } else url.search = "";
  url.hash = "";
  return {
    kind,
    href: url.href,
    label:
      kind === "website"
        ? host
        : kind === "linkedin"
          ? "LinkedIn"
          : kind === "x"
            ? "X"
            : "GitHub",
  };
}

export function groundContacts(
  name: string,
  selections: z.infer<typeof contactSelectionSchema>[],
  texts: SourceText[],
  sourceUrl: string,
  otherNames: string[] = [],
): Contact[] {
  const contacts: Contact[] = [];
  for (const selection of selections) {
    const selectedPassage = texts[selection.passageId];
    const contact = normalizeContact(selection.kind, selection.value);
    if (!selectedPassage || !contact) continue;
    const needle = selection.value.replace(/^mailto:/i, "");
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const literal = new RegExp(
      `(^|[\\s(<\\["'])${escaped}($|[\\s)>\\]"',;])`,
      "i",
    );
    if (!literal.test(selectedPassage.text)) continue;
    const associated = (part: SourceText) =>
      literal.test(part.text) &&
      containsName(part.text, name) &&
      !otherNames.some(
        (other) => other !== name && containsName(part.text, other),
      );
    // A model may point at a nested email element. Recover its individual author
    // block only when the same literal contact and full name coexist there.
    const passage = associated(selectedPassage)
      ? selectedPassage
      : texts.find(associated);
    if (!passage) continue;
    if (selection.kind === "email") {
      const local = contact.label
        .split("@")[0]
        .replace(/[^a-z]/gi, "")
        .toLowerCase();
      const own = normalizeText(name).replace(/[^a-z]/g, "");
      if (
        otherNames.some((other) => {
          const full = normalizeText(other).replace(/[^a-z]/g, "");
          return (
            other !== name &&
            full.length >= 5 &&
            local.includes(full) &&
            !local.includes(own)
          );
        })
      )
        continue;
    }
    contacts.push({
      ...contact,
      sourceUrl,
      quote: passage.text,
      page: passage.page,
    });
  }
  return mergeContacts([], contacts);
}

export function mergeContacts(existing: Contact[], incoming: Contact[]) {
  return [
    ...new Map(
      [...existing, ...incoming].map((c) => [
        `${c.kind}:${c.href.toLowerCase()}`,
        c,
      ]),
    ).values(),
  ];
}

export function contactIdentityContext(expert: Expert, text: string) {
  const normalized = normalizeText(text);
  return (
    expert.evidence.some((e) => normalized.includes(normalizeText(e.title))) ||
    !!(
      expert.affiliation &&
      normalized.includes(normalizeText(expert.affiliation))
    )
  );
}
