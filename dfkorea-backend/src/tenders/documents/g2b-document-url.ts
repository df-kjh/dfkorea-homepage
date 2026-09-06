const G2B_DOCUMENT_HOST = "www.g2b.go.kr";
const G2B_DOCUMENT_PATH = "/pn/pnp/pnpe/UntyAtchFile/downloadFile.do";
const G2B_DOCUMENT_QUERY_KEYS = new Set([
  "bidPbancNo",
  "bidPbancOrd",
  "fileType",
  "fileSeq",
  "prcmBsneSeCd",
]);

export interface G2bDocumentUrlBinding {
  sourceNoticeId: string;
  revision: string;
  fileSequence: number;
}

export const parseValidatedG2bDocumentUrl = (
  value: string,
  binding: G2bDocumentUrlBinding,
): URL | null => {
  try {
    const url = new URL(value);
    const entries = [...url.searchParams.entries()];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.hostname !== G2B_DOCUMENT_HOST ||
      url.pathname !== G2B_DOCUMENT_PATH ||
      entries.length !== G2B_DOCUMENT_QUERY_KEYS.size ||
      entries.some(([key]) => !G2B_DOCUMENT_QUERY_KEYS.has(key)) ||
      [...G2B_DOCUMENT_QUERY_KEYS].some(
        (key) => url.searchParams.getAll(key).length !== 1,
      ) ||
      url.searchParams.get("bidPbancNo") !== binding.sourceNoticeId ||
      url.searchParams.get("bidPbancOrd") !== binding.revision ||
      url.searchParams.get("fileType") !== "" ||
      url.searchParams.get("fileSeq") !== String(binding.fileSequence) ||
      url.searchParams.get("prcmBsneSeCd") !== "01"
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};
