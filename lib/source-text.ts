import type { SourceText } from "./schema";

const MAX_SOURCE_CHARS = 100_000;
const metadataField =
  /author|creator|personname|byline|inventor|contact|affiliation|citation_/i;

function decodeEntities(value: string) {
  return value
    .replace(/&#(x[\da-f]+|\d+);/gi, (original, code: string) => {
      const point =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : original;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

// Never render source HTML. Preserve tag boundaries and visible link destinations
// as plain text so names cannot become "MadaanAffiliation" during extraction.
function plainText(value: string) {
  return decodeEntities(
    value
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(
        /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, label: string) => {
          const target = decodeEntities(href).trim();
          return /^(https:\/\/|mailto:[^\s]+@)/i.test(target)
            ? `${label} (${target})`
            : label;
        },
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t \u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Preserve bylines before document text can exhaust the input budget. */
export function readSourceText(raw: unknown): SourceText[] {
  const parts: SourceText[] = [];
  let remaining = MAX_SOURCE_CHARS;
  const seen = new Set<string>();
  function visit(
    value: unknown,
    page: number | null,
    depth: number,
    field?: string,
  ) {
    if (depth > 14 || remaining <= 0) return;
    if (typeof value === "string") {
      const text = plainText(value);
      if (text.length < 2 || /^https?:\/\/\S+$/.test(text) || seen.has(text))
        return;
      seen.add(text);
      const clipped = text.slice(0, remaining);
      parts.push({ text: clipped, page, ...(field ? { field } : {}) });
      remaining -= clipped.length;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, page, depth + 1, field);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const ownPage =
      typeof record.page === "number" &&
      Number.isInteger(record.page) &&
      record.page > 0
        ? record.page
        : page;
    const context =
      typeof record.selector === "string" ? record.selector : field;
    if (typeof record.name === "string" && metadataField.test(context ?? "")) {
      const block = Object.entries(record)
        .filter(([key]) => !/^(selector|attributes|bounds)$/i.test(key))
        .map(
          ([key, child]) =>
            `${key}: ${typeof child === "string" ? child : JSON.stringify(child)}`,
        )
        .join("\n");
      visit(block, ownPage, depth + 1, context);
      return;
    }
    // Scraper elements retain HTML and author boundaries that flattened body text loses.
    if (Array.isArray(record.scraped_elements)) {
      for (const element of record.scraped_elements) {
        if (
          element &&
          typeof element === "object" &&
          typeof element.selector === "string" &&
          !/^article\b/.test(element.selector) &&
          metadataField.test(element.selector)
        )
          visit(element, ownPage, depth + 1);
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (metadataField.test(key) && !["html", "text"].includes(key))
        visit(child, ownPage, depth + 1, key);
    }
    if (Array.isArray(record.sections) && record.sections.length) {
      visit(record.sections, ownPage, depth + 1);
      return;
    }
    if (typeof record.html === "string" || typeof record.text === "string") {
      let content =
        typeof record.html === "string" && record.html.trim()
          ? record.html
          : String(record.text ?? "");
      // Element attributes can contain a link omitted from its inner HTML.
      if (Array.isArray(record.attributes)) {
        const href = record.attributes.find((a) => a?.name === "href")?.value;
        if (
          typeof href === "string" &&
          /^(https:\/\/|mailto:[^\s]+@)/i.test(href)
        )
          content += ` (${href})`;
      }
      visit(content, ownPage, depth + 1, context);
      // Author/contact metadata beside a text field has already been retained above.
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      if (
        metadataField.test(key) ||
        /^(url|source_url|link|href|selector|key|language|status|error|message|bounds|words|attributes)$/i.test(
          key,
        )
      )
        continue;
      visit(child, ownPage, depth + 1, context ?? key);
    }
  }
  visit(raw, null, 0);
  return parts.flatMap((part) => {
    const segments: SourceText[] = [];
    let text = part.text;
    while (text.length > 700) {
      const newline = text.lastIndexOf("\n", 700);
      const space = text.lastIndexOf(" ", 700);
      const end = newline >= 150 ? newline : space >= 150 ? space : 700;
      segments.push({ ...part, text: text.slice(0, end) });
      text = text.slice(end).trimStart();
    }
    if (text) segments.push({ ...part, text });
    return segments;
  });
}
