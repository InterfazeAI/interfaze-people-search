import type { Evidence, Expert, SearchScope, SourceRecord } from "./schema";
import { sourceIdentity } from "./sources";

export interface ResultGroup {
  source: Evidence;
  people: { expert: Expert; evidence: Evidence }[];
}

/** Group shared document claims without merging people or losing their evidence. */
export function groupResults(
  experts: Expert[],
  sources: SourceRecord[],
  scope: SearchScope = "all",
): ResultGroup[] {
  const groups = new Map<string, ResultGroup>();
  for (const expert of experts) {
    for (const evidence of expert.evidence) {
      if (scope !== "all" && evidence.kind !== scope) continue;
      let group = groups.get(evidence.sourceId);
      if (!group) {
        group = { source: evidence, people: [] };
        groups.set(evidence.sourceId, group);
      }
      if (!group.people.some((person) => person.expert.id === expert.id)) {
        group.people.push({ expert, evidence });
      }
    }
  }
  const order = new Map(
    sources.map((source, index) => [sourceIdentity(source.url), index]),
  );
  return [...groups.values()].sort(
    (a, b) =>
      (order.get(a.source.sourceId) ?? sources.length) -
      (order.get(b.source.sourceId) ?? sources.length),
  );
}
