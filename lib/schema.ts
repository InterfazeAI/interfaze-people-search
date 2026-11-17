import { z } from "zod";

export const sourceKinds = ["paper", "patent"] as const;
export type SourceKind = (typeof sourceKinds)[number];
export type SearchScope = "all" | SourceKind;
export const MAX_QUERY_LENGTH = 600;

export interface SearchConfig {
  query: string;
  scope: SearchScope;
  sourceLimit?: number;
}
export interface Candidate {
  url: string;
  title: string;
  kind: SourceKind;
}
export interface SourceText {
  text: string;
  page: number | null;
  field?: string;
}

export const contactKinds = [
  "email",
  "linkedin",
  "x",
  "github",
  "website",
] as const;
export const contactSelectionSchema = z.object({
  kind: z.enum(contactKinds),
  value: z.string().max(2048),
  passageId: z.number().int().nonnegative(),
});
export interface Contact {
  kind: (typeof contactKinds)[number];
  href: string;
  label: string;
  sourceUrl: string;
  quote: string;
  page: number | null;
}

// The model extracts claims. The evidence layer, never the model, decides what matches.
export const extractionSchema = z.object({
  kind: z.enum(["paper", "patent", "other"]),
  relevant: z.boolean(),
  title: z.string().max(400),
  year: z.number().int().min(1800).max(2100).nullable(),
  topicSummary: z.string().max(600),
  topicPassageId: z.number().int().nonnegative().nullable(),
  people: z
    .array(
      z.object({
        name: z.string().min(2).max(160),
        role: z.enum(["author", "inventor"]),
        identityPassageId: z.number().int().nonnegative(),
        affiliation: z.string().max(200).nullable(),
        affiliationPassageId: z.number().int().nonnegative().nullable(),
        contacts: z.array(contactSelectionSchema).max(8).default([]),
      }),
    )
    .max(10),
});
export type Extraction = z.input<typeof extractionSchema>;

export interface Evidence {
  sourceId: string;
  title: string;
  url: string;
  kind: SourceKind;
  year: number | null;
  role: "author" | "inventor";
  identityQuote: string;
  identityPage: number | null;
  topicQuote: string;
  topicPage: number | null;
  topicSummary: string;
  affiliation: string | null;
  affiliationQuote: string | null;
}
export interface Expert {
  id: string;
  name: string;
  affiliation: string | null;
  evidence: Evidence[];
  contacts?: Contact[];
}
export interface SourceRecord extends Candidate {
  /** Retained in memory for the in-app passage viewer; excluded from export. */
  texts?: SourceText[];
  status:
    "queued" | "reading" | "extracting" | "complete" | "skipped" | "failed";
  people: number;
  note?: string;
}
export interface SearchRun {
  config: SearchConfig;
  experts: Expert[];
  sources: SourceRecord[];
  phase: "discovering" | "reading" | "complete" | "cancelled" | "error";
  requests: number;
  keylessPreview?: {
    discoveredSources: number;
    selectedSources: number;
  };
  warnings: string[];
  startedAt: string;
  finishedAt?: string;
}
