import type { SourceText } from "./schema";

// Evidence quotes are selected verbatim from these passages. Never fabricate
// a highlight or a PDF position when the retained source does not contain it.
export function findSourcePassage(
  texts: SourceText[],
  quote: string,
  page: number | null,
): number {
  if (!quote.trim()) return -1;
  const exactPage = texts.findIndex(
    (text) => text.text === quote && text.page === page,
  );
  return exactPage >= 0
    ? exactPage
    : texts.findIndex((text) => text.text === quote);
}
