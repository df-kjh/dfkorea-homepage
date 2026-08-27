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

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
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

const renderInlineMarkdown = (value: string): string =>
  escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
