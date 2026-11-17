import type { Candidate, SearchScope, SourceKind } from "./schema";

const PAPER_HOSTS = [
  "proceedings.neurips.cc",
  "papers.nips.cc",
  "arxiv.org",
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "openreview.net",
  "proceedings.mlr.press",
  "aclanthology.org",
  "nature.com",
  "science.org",
  "dl.acm.org",
  "ieeexplore.ieee.org",
  "patents.google.com",
];
const PATENT_HOSTS = [
  "patents.google.com",
  "patents.justia.com",
  "patentscope.wipo.int",
  "data.epo.org",
  "image-ppubs.uspto.gov",
];
const isHost = (host: string, expected: string) =>
  host === expected || host.endsWith(`.${expected}`);

/** Only primary paper/patent locations. Never accept model-generated arbitrary navigation URLs. */
export function sourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return null;
    if (
      ![...PAPER_HOSTS, ...PATENT_HOSTS].some((host) =>
        isHost(url.hostname, host),
      )
    )
      return null;
    if (
      url.pathname === "/" ||
      /\/(search|list|searchresult|advanced)(\/|$)/i.test(url.pathname)
    )
      return null;
    if (
      isHost(url.hostname, "arxiv.org") &&
      !/^\/(abs|pdf|html)\//.test(url.pathname)
    )
      return null;
    if (
      isHost(url.hostname, "patents.google.com") &&
      !/^\/patent\//.test(url.pathname)
    )
      return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["gclid", "fbclid"].includes(key))
        url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

export function sourceIdentity(value: string): string {
  const url = new URL(value);
  if (["proceedings.neurips.cc", "papers.nips.cc"].includes(url.hostname)) {
    const paperHash = url.pathname.match(/\/([a-f0-9]{32})-/i)?.[1];
    if (paperHash) return `neurips:${paperHash.toLowerCase()}`;
  }
  if (isHost(url.hostname, "arxiv.org"))
    return `arxiv:${url.pathname
      .replace(/^\/(abs|pdf|html)\//, "")
      .replace(/\.pdf$/, "")
      .replace(/v\d+$/, "")}`;
  if (isHost(url.hostname, "patents.google.com"))
    return `patent:${url.pathname.split("/")[2]}`;
  return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`;
}

export function kindFromUrl(url: string): SourceKind {
  return PATENT_HOSTS.some((host) => isHost(new URL(url).hostname, host))
    ? "patent"
    : "paper";
}

export function selectCandidates(
  groups: Candidate[][],
  scope: SearchScope,
  max: number,
): Candidate[] {
  const result: Candidate[] = [];
  const seen = new Set<string>();
  // Round-robin preserves representation of papers and patents in a mixed search.
  for (let row = 0; row < Math.max(0, ...groups.map((g) => g.length)); row++) {
    for (const group of groups) {
      const candidate = group[row];
      if (!candidate) continue;
      const url = sourceUrl(candidate.url);
      if (!url) continue;
      const kind = kindFromUrl(url);
      const id = sourceIdentity(url);
      if (seen.has(id) || (scope !== "all" && scope !== kind)) continue;
      seen.add(id);
      result.push({ ...candidate, url, kind });
      if (result.length === max) return result;
    }
  }
  return result;
}

export function evidenceLink(url: string, quote: string, page: number | null) {
  if (isPdfSource(url)) return page ? `${url}#page=${page}` : url;
  // Text fragments are progressive enhancement: the original document still opens everywhere.
  const fragment = encodeURIComponent(quote.slice(0, 250)).replace(/-/g, "%2D");
  return `${url}#:~:text=${fragment}`;
}

export function isPdfSource(url: string) {
  return /\.pdf(?:\?|$)|arxiv\.org\/pdf\/|image-ppubs\.uspto\.gov\/.*\/downloadPdf\//i.test(
    url,
  );
}
