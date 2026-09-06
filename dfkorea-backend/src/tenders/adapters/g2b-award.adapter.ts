import {
  PublicApiClient,
  PublicApiRequest,
  TenderSourceError,
  parseKstDate,
  toNullableText,
} from "./public-api-client";
import { TenderAwardResult } from "../entities/tender-award-result.entity";
import { TenderSource } from "../domain/tender.enums";
import { TenderDecimal, positiveDecimal } from "../domain/tender-decimal";
export interface AwardWindow {
  start: string;
  end: string;
}
export type NormalizedAward = Omit<
  TenderAwardResult,
  "id" | "collectedAt" | "updatedAt"
>;
export interface AwardNoticeIdentity {
  source: string;
  sourceNoticeId: string;
  revision: string;
}
export type AwardInvalidation =
  | (AwardNoticeIdentity & { kind: "NOTICE_EXCLUDED" })
  | (AwardNoticeIdentity & {
      kind: "SINGLE_ITEM_RECONCILED";
      openedAt: Date;
      retainedProductClassification: string | null;
    });
export type AwardDiagnostic =
  | "AMBIGUOUS_CLASS_IDENTITY"
  | "INCOMPLETE_AWARD_EVIDENCE";
export interface AwardPage {
  invalidations?: AwardInvalidation[];
  diagnostics?: AwardDiagnostic[];
  items: NormalizedAward[];
  nextCursor: string | null;
  fetchedCount: number;
  excludedCount: number;
}
export const G2B_AWARD_BASE_URL =
  "https://apis.data.go.kr/1230000/as/ScsbidInfoService";
const BID_BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";
const FINAL_OPERATION = "getScsbidListSttusThng";
const PRICE_OPERATION = "getOpengResultListInfoThngPreparPcDetail";
const LED = /(?:\bLED\b|엘이디|발광다이오드)/i;
const EXCLUDED = /(?:취소|유찰|재입찰|단가)/;
type Row = Record<string, unknown>;
export class G2bAwardAdapter {
  constructor(
    private readonly client: PublicApiClient,
    private readonly config: {
      serviceKey: string;
      baseUrl?: string;
      relayEnabled?: boolean;
    },
    private readonly relay?: PublicApiClient,
    private readonly trackedNotices?: (
      identities: AwardNoticeIdentity[],
    ) => Promise<AwardNoticeIdentity[]>,
  ) {}
  async fetchWindow(
    window: AwardWindow,
    cursor: string | null,
  ): Promise<AwardPage> {
    if (
      !this.config.serviceKey ||
      !/^\d{4}-\d{2}-\d{2}$/.test(window.start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(window.end) ||
      window.start > window.end
    )
      throw this.invalid();
    const match = /^([1-9]\d{0,6}):(\d{1,2})$/.exec(cursor ?? "1:0");
    if (!match || Number(match[1]) > 1000000 || Number(match[2]) >= 100)
      throw this.invalid();
    const pageNo = Number(match[1]),
      offset = Number(match[2]);
    const page = await this.fetch(
      FINAL_OPERATION,
      {
        inqryDiv: "1",
        inqryBgnDt: window.start.replace(/-/g, "") + "0000",
        inqryEndDt: window.end.replace(/-/g, "") + "2359",
      },
      pageNo,
    );
    if (!page.items.length && page.totalCount > (pageNo - 1) * 100) {
      throw new TenderSourceError(TenderSource.G2B, "INVALID_RESPONSE");
    }
    const identities = page.items.flatMap(
      (row) => this.noticeIdentity(row) ?? [],
    );
    const tracked =
      identities.length && this.trackedNotices
        ? await this.trackedNotices(identities)
        : [];
    const trackedKeys = new Set(
      tracked.map(
        (identity) =>
          `${identity.source}:${identity.sourceNoticeId}:${identity.revision}`,
      ),
    );
    const items: NormalizedAward[] = [];
    const invalidations: AwardInvalidation[] = [];
    const diagnostics: AwardDiagnostic[] = [];
    let consumed = offset;
    // One monthly page plus at most one candidate's three bounded detail calls.
    // Re-read the list on resume instead of persisting personal provider payloads.
    for (; consumed < page.items.length; consumed++) {
      const row = page.items[consumed];
      const identity = this.noticeIdentity(row);
      if (
        !identity ||
        (!LED.test(String(row.bidNtceNm)) &&
          !trackedKeys.has(
            `${identity.source}:${identity.sourceNoticeId}:${identity.revision}`,
          ))
      )
        continue;
      const normalized = await this.enrich(row, page.items);
      if (normalized.item) items.push(normalized.item);
      invalidations.push(...normalized.invalidations);
      diagnostics.push(...normalized.diagnostics);
      consumed++;
      break;
    }
    const nextCursor =
      consumed < page.items.length
        ? `${pageNo}:${consumed}`
        : pageNo * 100 < page.totalCount && page.items.length > 0
          ? `${pageNo + 1}:0`
          : null;
    const fetchedCount = Math.max(0, consumed - offset);
    return {
      items,
      invalidations,
      diagnostics,
      nextCursor,
      fetchedCount,
      excludedCount: fetchedCount - items.length,
    };
  }
  private noticeIdentity(row: Row): AwardNoticeIdentity | null {
    return /^[A-Za-z0-9-]{1,40}$/.test(String(row.bidNtceNo)) &&
      /^\d{3}$/.test(String(row.bidNtceOrd))
      ? {
          source: TenderSource.G2B,
          sourceNoticeId: String(row.bidNtceNo),
          revision: String(row.bidNtceOrd),
        }
      : null;
  }
  private async enrich(
    final: Row,
    observedFinals: Row[],
  ): Promise<{
    item: NormalizedAward | null;
    invalidations: AwardInvalidation[];
    diagnostics: AwardDiagnostic[];
  }> {
    const result: {
      item: NormalizedAward | null;
      invalidations: AwardInvalidation[];
      diagnostics: AwardDiagnostic[];
    } = { item: null, invalidations: [], diagnostics: [] };
    const notice = this.noticeIdentity(final)!;
    const identity = { inqryDiv: "2", bidNtceNo: String(final.bidNtceNo) };
    const detailPage = await this.fetch(
      "getBidPblancListInfoThng",
      identity,
      1,
    );
    const details = detailPage.items.filter((row) =>
      this.sameNotice(row, final),
    );
    if (!this.completeEvidence(detailPage, final) || details.length !== 1) {
      result.diagnostics.push("INCOMPLETE_AWARD_EVIDENCE");
      return result;
    }
    const detail = details[0];
    // Only explicit authoritative notice status invalidates an entire revision.
    // A missing final date, missing page or failed request is never cancellation.
    if (
      ["취소공고", "취소", "유찰", "재입찰"].includes(String(detail.ntceKindNm))
    ) {
      result.invalidations.push({ kind: "NOTICE_EXCLUDED", ...notice });
      return result;
    }
    const openedAt = parseKstDate(final.rlOpengDt);
    if (
      !openedAt ||
      !parseKstDate(final.fnlSucsfDate) ||
      !positiveDecimal(final.sucsfbidAmt) ||
      !/^0+$/.test(String(final.rbidNo)) ||
      !/^\d{1,10}$/.test(String(final.bidClsfcNo))
    )
      return result;
    // Total KRW comparability requires explicit total wording and domestic
    // goods. Unknown or contradictory wording is not an invalidation signal.
    if (
      detail.intrbidYn !== "N" ||
      !/총액/.test(String(detail.bidNtceNm)) ||
      EXCLUDED.test(String(detail.bidNtceNm) + String(detail.ntceKindNm))
    )
      return result;
    const productPage = await this.fetch(
      "getBidPblancListInfoThngPurchsObjPrdct",
      { ...identity, bidNtceOrd: String(final.bidNtceOrd) },
      1,
    );
    const noticeProducts = productPage.items.filter((row) =>
      this.sameNotice(row, final),
    );
    if (
      !this.completeEvidence(productPage, final) ||
      noticeProducts.length !== productPage.items.length ||
      noticeProducts.some((row) => !/^\d{1,10}$/.test(String(row.bidClsfcNo)))
    ) {
      result.diagnostics.push("INCOMPLETE_AWARD_EVIDENCE");
      return result;
    }
    const products = noticeProducts.filter(
      (row) => String(row.bidClsfcNo) === String(final.bidClsfcNo),
    );
    if (
      products.length !== 1 ||
      (toNullableText(products[0].rbidNo) !== null &&
        String(products[0].rbidNo) !== String(final.rbidNo))
    )
      return result;
    const classification = toNullableText(products[0].dtilPrdctClsfcNo);
    if (
      !classification ||
      !/^\d{10}$/.test(classification) ||
      toNullableText(detail.dtilPrdctClsfcNo) !== classification
    )
      return result;
    const pricePage = await this.fetch(PRICE_OPERATION, identity, 1);
    if (
      !this.completeEvidence(pricePage, final) ||
      pricePage.items.some(
        (row) =>
          this.sameNotice(row, final) &&
          (!/^\d{1,10}$/.test(String(row.bidClsfcNo)) ||
            !/^\d+$/.test(String(row.rbidNo))),
      )
    ) {
      result.diagnostics.push("INCOMPLETE_AWARD_EVIDENCE");
      return result;
    }
    const prices = pricePage.items.filter(
      (row) =>
        this.sameNotice(row, final) &&
        String(row.bidClsfcNo) === String(final.bidClsfcNo) &&
        String(row.rbidNo) === String(final.rbidNo),
    );
    const price = prices[0];
    if (
      !price ||
      prices.some(
        (row) => row.bssamt !== price.bssamt || row.plnprc !== price.plnprc,
      )
    )
      return result;
    // The database key has no bidClsfcNo. Inspect the complete notice product
    // map and all observed final/price lots before accepting even the first lot.
    // This works across final-list offsets/pages because the bounded product and
    // reserve-price responses cover the whole notice. Unknown lot mappings are
    // also unsafe; never guess that an unmapped class belongs to another item.
    const observedClasses = new Set(
      [...observedFinals, ...pricePage.items]
        .filter(
          (row) =>
            this.sameNotice(row, final) &&
            String(row.rbidNo) === String(final.rbidNo),
        )
        .map((row) => String(row.bidClsfcNo)),
    );
    const classProducts = new Map<string, Set<string>>();
    for (const product of noticeProducts) {
      const bidClass = String(product.bidClsfcNo);
      const codes = classProducts.get(bidClass) ?? new Set<string>();
      codes.add(String(product.dtilPrdctClsfcNo));
      classProducts.set(bidClass, codes);
    }
    const collidingClasses = [...classProducts.values()].filter((codes) =>
      codes.has(classification),
    );
    if (
      collidingClasses.length > 1 ||
      [...observedClasses].some((bidClass) => {
        const codes = classProducts.get(bidClass);
        return !codes || codes.size !== 1 || !/^\d{10}$/.test([...codes][0]);
      })
    ) {
      result.diagnostics.push("AMBIGUOUS_CLASS_IDENTITY");
      return result;
    }
    const basis = positiveDecimal(price.bssamt),
      expected = positiveDecimal(price.plnprc),
      winning = positiveDecimal(final.sucsfbidAmt);
    if (!basis || !expected || !winning) return result;
    // Enforce the persisted numeric(20,2) domain before PostgreSQL can round data.
    const amounts = [price.bssamt, price.plnprc, final.sucsfbidAmt];
    if (
      amounts.some(
        (value) =>
          typeof value !== "string" || !/^\d{1,18}(?:\.\d{1,2})?$/.test(value),
      )
    )
      return result;
    const isLed = LED.test(String(products[0].dtilPrdctClsfcNoNm));
    const singleNoticeClass =
      noticeProducts.length === 1 &&
      pricePage.items
        .filter((row) => this.sameNotice(row, final))
        .every((row) => String(row.bidClsfcNo) === String(final.bidClsfcNo));
    // Persistence predates bid-class storage. A complete single-item notice can
    // reconcile the prior product identity. Multi-class changes cannot prove
    // that mapping: retain unrelated history and expose a safe review code.
    if (singleNoticeClass)
      result.invalidations.push({
        kind: "SINGLE_ITEM_RECONCILED",
        ...notice,
        openedAt,
        retainedProductClassification: isLed ? classification : null,
      });
    else result.diagnostics.push("AMBIGUOUS_CLASS_IDENTITY");
    if (!isLed) return result;
    result.item = {
      source: TenderSource.G2B,
      sourceNoticeId: String(final.bidNtceNo),
      revision: String(final.bidNtceOrd),
      productClassification: classification,
      productGroup: "LED",
      awardMethod: toNullableText(detail.sucsfbidMthdNm),
      region: null,
      openedAt: parseKstDate(final.rlOpengDt)!,
      basisAmount: String(price.bssamt),
      expectedPrice: String(price.plnprc),
      winningAmount: String(final.sucsfbidAmt),
      adjustmentRate: this.persistedRate(expected.divide(basis)),
      winningRate: this.persistedRate(winning.divide(expected)),
      isFinalAward: true,
      isFailedBid: false,
    };
    return result;
  }
  private completeEvidence(
    page: { items: Row[]; totalCount: number },
    final: Row,
  ): boolean {
    // Provider counts alone cannot establish uniqueness: every returned row
    // must also have a complete notice/revision identity in the requested scope.
    return (
      page.totalCount === page.items.length &&
      page.totalCount <= 100 &&
      page.items.every(
        (row) =>
          this.noticeIdentity(row) !== null &&
          row.bidNtceNo === final.bidNtceNo,
      )
    );
  }
  private persistedRate(value: TenderDecimal): string | null {
    const serialized = value.toString(6, true);
    // numeric(10,6) cannot hold five integer digits, including rounding carry.
    return /^\d{1,4}\.\d{6}$/.test(serialized) ? serialized : null;
  }
  private sameNotice(row: Row, final: Row): boolean {
    return (
      row.bidNtceNo === final.bidNtceNo && row.bidNtceOrd === final.bidNtceOrd
    );
  }
  private async fetch(
    operation: string,
    query: Record<string, string>,
    pageNo: number,
  ) {
    const award =
      operation === FINAL_OPERATION || operation === PRICE_OPERATION;
    const request: PublicApiRequest = {
      source: TenderSource.G2B,
      baseUrl: award ? this.config.baseUrl || G2B_AWARD_BASE_URL : BID_BASE_URL,
      operation,
      query: { serviceKey: this.config.serviceKey, type: "json", ...query },
    };
    try {
      return await this.client.getPage(request, pageNo);
    } catch (error) {
      if (
        this.config.relayEnabled &&
        this.relay &&
        error instanceof TenderSourceError &&
        error.code === "PROVIDER_RESULT_ERROR" &&
        error.status === 200 &&
        error.providerResultCode === null
      )
        return this.relay.getPage(request, pageNo);
      throw error;
    }
  }
  private invalid() {
    return new TenderSourceError(TenderSource.G2B, "CONFIGURATION_ERROR");
  }
}
