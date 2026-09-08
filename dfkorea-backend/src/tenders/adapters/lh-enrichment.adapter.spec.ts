import { NormalizedTender } from "../domain/normalized-tender";
import { ProcurementType, TenderSource } from "../domain/tender.enums";
import { LhEnrichmentAdapter } from "./lh-enrichment.adapter";

const tender = (overrides: Partial<NormalizedTender> = {}): NormalizedTender => ({
  source: TenderSource.LH,
  sourceNoticeId: "2603251",
  revision: "00",
  title: "LED 조명기구 구매",
  orderingOrganization: "LH 본사",
  demandOrganization: null,
  registeredAt: new Date("2026-09-01T00:00:00.000Z"),
  bidStartedAt: new Date("2026-09-02T00:00:00.000Z"),
  bidEndedAt: new Date("2026-09-10T00:00:00.000Z"),
  openedAt: new Date("2026-09-10T01:00:00.000Z"),
  region: null,
  procurementType: ProcurementType.GOODS,
  contractMethod: "제한경쟁",
  estimatedAmount: "123456789",
  sourceUrl:
    "https://ebid.lh.or.kr/ebid.et.tp.cmd.BidgdsDetailListCmd.dev?bidNum=2603251&bidDegree=00&cstrtnJobGbCd=30&emrgncyOrder=Y",
  itemName: "LED 조명기구 구매",
  description: "",
  attachmentNames: ["공고문.zip", "물량내역.xlsx"],
  rawData: {
    lh: {
      workTypeCode: "30",
      emergencyOrder: "Y",
      detailPath:
        "/ebid.et.tp.cmd.BidgdsDetailListCmd.dev?bidNum=2603251&bidDegree=00&cstrtnJobGbCd=30&emrgncyOrder=Y",
      basisAmount: "123456789",
      attachments: [
        {
          sequence: "10",
          displayName: "공고문.zip",
          savedName: "20260901_notice.zip",
        },
        {
          sequence: "20",
          displayName: "물량내역.xlsx",
          savedName: "20260901_items.xlsx",
        },
      ],
    },
  },
  ...overrides,
});

describe("LhEnrichmentAdapter", () => {
  const adapter = new LhEnrichmentAdapter();

  it("uses only persisted LH metadata to emit basis evidence and exact attachment identities", async () => {
    const result = await adapter.enrich(
      tender(),
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      basisAmount: {
        value: "123456789",
        evidence: {
          source: "LH_PAGE",
          operation: "LH_NOTICE_DETAIL",
          field: "basisAmount",
        },
      },
      lowerLimitRate: null,
      lawKind: null,
      formulaVariables: [],
      regions: [],
      licenses: [],
      purchaseItems: [],
      failures: [],
    });
    expect(result).not.toHaveProperty("pricingContext");
    expect(result).not.toHaveProperty("pricingEvidence");
    expect(result.documents).toHaveLength(2);
    expect(result.documents[0]).toMatchObject({
      identity: "LH:2603251:00:10",
      displayName: "공고문.zip",
      formatHint: "ZIP",
      source: "LH_PAGE",
      sourceNoticeId: "2603251",
      revision: "00",
      evidence: {
        source: "LH_PAGE",
        operation: "LH_NOTICE_DOCUMENTS",
        field: "attachment:10",
      },
    });
    expect(Object.fromEntries(new URL(result.documents[0].url).searchParams)).toEqual({
      noticeId: "2603251",
      revision: "00",
      sequence: "10",
      displayName: "공고문.zip",
      savedName: "20260901_notice.zip",
    });
  });

  it("rejects another source and malformed persisted metadata before any external work", async () => {
    await expect(
      adapter.enrich(
        tender({ source: TenderSource.G2B }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "ENRICHMENT_SOURCE_MISMATCH" });

    const malformed = [
      {},
      { lh: null },
      { lh: { ...(tender().rawData.lh as object), workTypeCode: "20" } },
      {
        lh: {
          ...(tender().rawData.lh as object),
          basisAmount: "123원",
        },
      },
      {
        lh: {
          ...(tender().rawData.lh as object),
          attachments: [
            { sequence: "10", displayName: "공고문.pdf", savedName: "../x" },
          ],
        },
      },
    ];
    for (const rawData of malformed) {
      await expect(
        adapter.enrich(tender({ rawData }), new AbortController().signal),
      ).rejects.toMatchObject({ code: "ENRICHMENT_INVALID_METADATA" });
    }
  });

  it("binds persisted detail identity to the tender identity", async () => {
    const rawData = structuredClone(tender().rawData);
    (rawData.lh as { detailPath: string }).detailPath =
      "/ebid.et.tp.cmd.BidgdsDetailListCmd.dev?bidNum=other&bidDegree=00&cstrtnJobGbCd=30&emrgncyOrder=Y";

    await expect(
      adapter.enrich(tender({ rawData }), new AbortController().signal),
    ).rejects.toMatchObject({ code: "ENRICHMENT_NOTICE_MISMATCH" });
  });
});
