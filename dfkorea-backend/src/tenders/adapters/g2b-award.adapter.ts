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
export interface AwardPage {
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
    const items: NormalizedAward[] = [];
    let consumed = offset;
    // One monthly page plus at most one candidate's three bounded detail calls.
    // Re-read the list on resume instead of persisting personal provider payloads.
    for (; consumed < page.items.length; consumed++) {
      const row = page.items[consumed];
      if (!this.isCandidate(row)) continue;
      const normalized = await this.enrich(row);
      if (normalized) items.push(normalized);
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
      nextCursor,
      fetchedCount,
      excludedCount: fetchedCount - items.length,
    };
  }
  private isCandidate(row: Row): boolean {
    const title = toNullableText(row.bidNtceNm) ?? "";
    return (
      LED.test(title) &&
      !EXCLUDED.test(title) &&
      !!parseKstDate(row.fnlSucsfDate) &&
      !!parseKstDate(row.rlOpengDt) &&
      !!positiveDecimal(row.sucsfbidAmt) &&
      /^0+$/.test(String(row.rbidNo)) &&
      /^[A-Za-z0-9-]{1,40}$/.test(String(row.bidNtceNo)) &&
      /^\d{3}$/.test(String(row.bidNtceOrd))
    );
  }
  private async enrich(final: Row): Promise<NormalizedAward | null> {
    const identity = { inqryDiv: "2", bidNtceNo: String(final.bidNtceNo) };
    const detailPage = await this.fetch(
      "getBidPblancListInfoThng",
      identity,
      1,
    );
    const details = detailPage.items.filter((row) =>
      this.sameNotice(row, final),
    );
    if (details.length !== 1 || detailPage.totalCount > 100) return null;
    const detail = details[0];
    // The official goods API has no structured unit/total or currency field.
    // Require explicit total wording in its own notice title and domestic goods;
    // absence is unknown, never evidence of a comparable total KRW contract.
    if (
      detail.intrbidYn !== "N" ||
      !/(?:총액)/.test(String(detail.bidNtceNm)) ||
      EXCLUDED.test(String(detail.bidNtceNm) + String(detail.ntceKindNm))
    )
      return null;
    const productPage = await this.fetch(
      "getBidPblancListInfoThngPurchsObjPrdct",
      { ...identity, bidNtceOrd: String(final.bidNtceOrd) },
      1,
    );
    const products = productPage.items.filter((row) =>
      this.sameNotice(row, final),
    );
    if (products.length !== 1 || productPage.totalCount > 100) return null;
    const classification = toNullableText(products[0].dtilPrdctClsfcNo);
    if (
      !classification ||
      !/^\d{10}$/.test(classification) ||
      !LED.test(String(products[0].dtilPrdctClsfcNoNm))
    )
      return null;
    const pricePage = await this.fetch(PRICE_OPERATION, identity, 1);
    const prices = pricePage.items.filter(
      (row) =>
        this.sameNotice(row, final) &&
        String(row.bidClsfcNo) === String(final.bidClsfcNo) &&
        String(row.rbidNo) === String(final.rbidNo),
    );
    const price = prices[0];
    if (
      !price ||
      pricePage.totalCount > 100 ||
      prices.some(
        (row) => row.bssamt !== price.bssamt || row.plnprc !== price.plnprc,
      )
    )
      return null;
    const basis = positiveDecimal(price.bssamt),
      expected = positiveDecimal(price.plnprc),
      winning = positiveDecimal(final.sucsfbidAmt);
    if (!basis || !expected || !winning) return null;
    // Enforce the persisted numeric(20,2) domain before PostgreSQL can round data.
    const amounts = [price.bssamt, price.plnprc, final.sucsfbidAmt];
    if (
      amounts.some(
        (value) =>
          typeof value !== "string" || !/^\d{1,18}(?:\.\d{1,2})?$/.test(value),
      )
    )
      return null;
    return {
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
