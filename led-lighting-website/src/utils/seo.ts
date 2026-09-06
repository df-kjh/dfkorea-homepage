export const COMPANY_NAME = "(주)디에프코리아";
export const DEFAULT_OG_IMAGE = "/images/og-image.jpg";

export interface AbsoluteUrlOptions {
  apiBaseUrl: string;
  siteUrl: string;
  fallbackPath?: string;
}

export const normalizeBaseUrl = (url: string): string => url.replace(/\/$/, "");

export const toAbsoluteAssetUrl = (
  path: string | null | undefined,
  { apiBaseUrl, siteUrl, fallbackPath = DEFAULT_OG_IMAGE }: AbsoluteUrlOptions,
): string => {
  const source = path || fallbackPath;

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  const normalizedPath = source.startsWith("/") ? source : `/${source}`;
  const baseUrl = source === fallbackPath ? siteUrl : apiBaseUrl;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
};

export const renderMarkdown = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = (): void => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();

    if (!line) {
      closeList();
      continue;
    }

    const header = splitTableRow(line);
    const separator = splitTableRow(lines[index + 1] || "");
    if (
      header && separator && header.length === separator.length &&
      separator.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      closeList();
      const alignments = separator.map((cell) =>
        cell.endsWith(":") ? (cell.startsWith(":") ? "center" : "right") : "left",
      );
      const renderRow = (cells: string[], tag: "th" | "td"): string =>
        `<tr>${alignments.map((alignment, column) =>
          `<${tag}${tag === "th" ? ' scope="col"' : ""} style="text-align:${alignment}">${renderInlineMarkdown(cells[column] || "")}</${tag}>`,
        ).join("")}</tr>`;

      html.push('<div class="markdown-table-wrapper" role="region" aria-label="표" tabindex="0"><table>');
      html.push(`<thead>${renderRow(header, "th")}</thead><tbody>`);
      index += 1;
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1]!.trim();
        // A heading/list starts a new block even when its text includes a pipe.
        if (/^(?:#{1,3} |[-*]\s+)/.test(nextLine)) break;
        const row = splitTableRow(nextLine);
        if (!row) break;
        html.push(renderRow(row, "td"));
        index += 1;
      }
      html.push("</tbody></table></div>");
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("\n");
};

export const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_`~\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// A pipe inside an escaped pair or a complete code span belongs to its cell.
// Match these first so only the remaining pipes divide the table columns.
const splitTableRow = (value: string): string[] | null => {
  const cells: string[] = [];
  let start = 0;
  for (const match of value.matchAll(/\\[\\|]|(`+)([^`]*?)\1|\|/g)) {
    if (match[0] !== "|") continue;
    cells.push(value.slice(start, match.index).trim());
    start = match.index + 1;
  }
  if (cells.length === 0) return null;
  cells.push(value.slice(start).trim());
  if (cells[0] === "") cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells.length ? cells : null;
};

const renderEmphasis = (value: string): string =>
  escapeHtml(value.replace(/\\([\\|])/g, "$1"))
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const renderInlineMarkdown = (value: string): string => {
  const result: string[] = [];
  let start = 0;
  for (const match of value.matchAll(/(`+)([^`]*?)\1|(!?)\[([^\]]*)\]\(([^)]*)\)/g)) {
    result.push(renderEmphasis(value.slice(start, match.index)));
    if (match[1]) {
      result.push(`<code>${escapeHtml(match[2]!)}</code>`);
    } else {
      const url = match[5]!.trim();
      // Keep raw HTML disabled and reject executable/protocol-relative URLs.
      // Attribute escaping also prevents a quoted URL from adding HTML attributes.
      const isSafeUrl = !/[\s\\\u0000-\u001f\u007f]/.test(url) &&
        (/^https?:\/\/[^/]+/i.test(url) || /^\/(?!\/)/.test(url));
      if (!isSafeUrl) {
        result.push(escapeHtml(match[0]));
      } else if (match[3]) {
        result.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(match[4]!)}" loading="lazy" />`);
      } else {
        result.push(`<a href="${escapeHtml(url)}">${renderEmphasis(match[4]!)}</a>`);
      }
    }
    start = match.index + match[0].length;
  }
  result.push(renderEmphasis(value.slice(start)));
  return result.join("");
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
