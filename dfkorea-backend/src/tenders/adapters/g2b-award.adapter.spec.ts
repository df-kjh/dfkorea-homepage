import { readFileSync } from "fs";
import { join } from "path";
import { G2bAwardAdapter } from "./g2b-award.adapter";
import { PublicApiClient } from "./public-api-client";

const recorded = JSON.parse(
  readFileSync(join(__dirname, "fixtures/g2b-awards.json"), "utf8"),
);
const window = { start: "2026-09-01", end: "2026-09-30" };
const setup = (
  mutate: (fixtures: typeof recorded) => void = () => undefined,
  tracked = false,
) => {
  const fixtures = structuredClone(recorded);
  mutate(fixtures);
  const calls: URL[] = [];
  const client = new PublicApiClient(async (input) => {
    const url = new URL(input);
    calls.push(url);
    return new Response(
      JSON.stringify(fixtures[url.pathname.split("/").at(-1)!]),
    );
  });
  return {
    adapter: new G2bAwardAdapter(
      client,
      { serviceKey: "fixture-key" },
      undefined,
      async (identities) => (tracked ? identities : []),
    ),
    calls,
    fixtures,
  };
};
describe("G2bAwardAdapter", () => {
  it("never returns a rate that overflows the persisted numeric scale", async () => {
    const { adapter } = setup((f) => {
      f.getScsbidListSttusThng.response.body.items[0].sucsfbidAmt =
        "9007199254740993.01";
    });
    expect(
      (await adapter.fetchWindow(window, null)).items[0].winningRate,
    ).toBeNull();
  });
  it("rejects empty nonterminal pages instead of acknowledging missing results", async () => {
    const { adapter } = setup((f) => {
      f.getScsbidListSttusThng.response.body.items = [];
      f.getScsbidListSttusThng.response.body.totalCount = "100";
    });
    await expect(adapter.fetchWindow(window, null)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("joins official final goods, reserve-price and purchase-item rows without retaining identities", async () => {
    const { adapter, calls } = setup();
    const page = await adapter.fetchWindow(window, null);
    expect(page.items).toEqual([
      expect.objectContaining({
        sourceNoticeId: "R26BK01000001",
        productClassification: "3911210201",
        basisAmount: "100000000.00",
        expectedPrice: "99820000.00",
        winningAmount: "88700052.00",
        adjustmentRate: "0.998200",
        winningRate: "0.888600",
        isFinalAward: true,
      }),
    ]);
    expect(JSON.stringify(page)).not.toMatch(
      /fixture company|fixture person|fixture address|bidwinnr|payload/,
    );
    expect(calls[0].pathname).toBe(
      "/1230000/as/ScsbidInfoService/getScsbidListSttusThng",
    );
    expect(calls).toHaveLength(4);
    expect(page.nextCursor).toBeNull();
  });
  it("preserves amounts above Number.MAX_SAFE_INTEGER", async () => {
    const { adapter } = setup((f) => {
      f.getScsbidListSttusThng.response.body.items[0].sucsfbidAmt =
        "9007199254740993.01";
    });
    expect(
      (await adapter.fetchWindow(window, null)).items[0].winningAmount,
    ).toBe("9007199254740993.01");
  });
  it.each(["취소공고", "유찰", "재입찰"])("excludes %s", async (status) => {
    const { adapter } = setup((f) => {
      f.getBidPblancListInfoThng.response.body.items[0].ntceKindNm = status;
    });
    expect((await adapter.fetchWindow(window, null)).items).toEqual([]);
  });
  it.each(["단가", ""])(
    "does not infer total contracts from %s",
    async (kind) => {
      const { adapter } = setup((f) => {
        f.getBidPblancListInfoThng.response.body.items[0].bidNtceNm = `LED 구매 ${kind}`;
        f.getScsbidListSttusThng.response.body.items[0].bidNtceNm = `LED 구매 ${kind}`;
      });
      expect((await adapter.fetchWindow(window, null)).items).toEqual([]);
    },
  );
  it("excludes non-final, non-LED and multiple-item results", async () => {
    for (const mutation of [
      (f) => {
        f.getScsbidListSttusThng.response.body.items[0].fnlSucsfDate = "";
      },
      (f) => {
        f.getScsbidListSttusThng.response.body.items[0].bidNtceNm =
          "컴퓨터 총액";
      },
      (f) => {
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items.push({
          ...f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0],
          prdctSno: "2",
        });
      },
    ])
      expect(
        (await setup(mutation).adapter.fetchWindow(window, null)).items,
      ).toEqual([]);
  });
  it("bounds each tick to one list page and one LED candidate and resumes offsets", async () => {
    const { adapter, calls } = setup((f) => {
      const b = f.getScsbidListSttusThng.response.body;
      b.items.push({ ...b.items[0] });
      b.totalCount = "101";
    });
    const first = await adapter.fetchWindow(window, null);
    expect(first.nextCursor).toBe("1:1");
    expect(calls).toHaveLength(4);
    const second = await adapter.fetchWindow(window, first.nextCursor);
    expect(second.nextCursor).toBe("2:0");
  });
  it("rejects unsafe cursors before any HTTP call", async () => {
    const { adapter, calls } = setup();
    await expect(adapter.fetchWindow(window, "1:-1")).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
    expect(calls).toEqual([]);
  });
});

describe("award authoritative reconciliation regressions", () => {
  const identity = {
    source: "G2B",
    sourceNoticeId: "R26BK01000001",
    revision: "000",
  };
  it.each(["", "2"])(
    "rejects absent or mismatching purchase bid class %s",
    async (bidClass) => {
      const { adapter } = setup((f) => {
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0].bidClsfcNo =
          bidClass;
      });
      const page = await adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([]);
    },
  );
  it("matches the final lot rather than accepting another lot's LED item", async () => {
    const { adapter } = setup((f) => {
      const body = f.getBidPblancListInfoThngPurchsObjPrdct.response.body;
      body.items = [
        { ...body.items[0], bidClsfcNo: "2", dtilPrdctClsfcNo: "3911210202" },
        body.items[0],
      ];
      body.totalCount = "2";
    });
    const page = await adapter.fetchWindow(window, null);
    expect(page.items[0].productClassification).toBe("3911210201");
    expect(page.invalidations).toEqual([]);
    expect(page.diagnostics).toContain("AMBIGUOUS_CLASS_IDENTITY");
  });
  it("rejects conflicting product classification or supplied rebid identity", async () => {
    for (const change of [
      { dtilPrdctClsfcNo: "3911210202" },
      { rbidNo: "001" },
    ]) {
      const { adapter } = setup((f) =>
        Object.assign(
          f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0],
          change,
        ),
      );
      const page = await adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([]);
    }
  });
  it.each(["취소공고", "유찰", "재입찰"])(
    "returns only a notice identity for authoritative %s",
    async (status) => {
      const { adapter } = setup((f) => {
        f.getBidPblancListInfoThng.response.body.items[0].ntceKindNm = status;
        f.getScsbidListSttusThng.response.body.items[0].fnlSucsfDate = "";
      });
      const page = await adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([
        { kind: "NOTICE_EXCLUDED", ...identity },
      ]);
      expect(JSON.stringify(page)).not.toMatch(
        /fixture company|fixture person|bidwinnr|payload/,
      );
    },
  );
  it("reconciles a tracked notice even after its LED title and single product become non-LED", async () => {
    const { adapter, calls } = setup((f) => {
      f.getScsbidListSttusThng.response.body.items[0].bidNtceNm =
        "컴퓨터 구매 총액";
      Object.assign(f.getBidPblancListInfoThng.response.body.items[0], {
        bidNtceNm: "컴퓨터 구매 총액",
        dtilPrdctClsfcNo: "4321150801",
        dtilPrdctClsfcNoNm: "컴퓨터",
      });
      Object.assign(
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0],
        { dtilPrdctClsfcNo: "4321150801", dtilPrdctClsfcNoNm: "컴퓨터" },
      );
    }, true);
    const page = await adapter.fetchWindow(window, null);
    expect(page.items).toEqual([]);
    expect(page.invalidations).toEqual([
      {
        kind: "SINGLE_ITEM_RECONCILED",
        ...identity,
        openedAt: new Date("2026-09-01T01:00:00Z"),
        retainedProductClassification: null,
      },
    ]);
    expect(calls.length).toBeLessThanOrEqual(4);
  });
  it("returns replacement identity for a completely observed single-item reclassification", async () => {
    const { adapter } = setup((f) => {
      f.getBidPblancListInfoThng.response.body.items[0].dtilPrdctClsfcNo =
        "3911210202";
      f.getBidPblancListInfoThngPurchsObjPrdct.response.body.items[0].dtilPrdctClsfcNo =
        "3911210202";
    }, true);
    const page = await adapter.fetchWindow(window, null);
    expect(page.invalidations).toEqual([
      {
        kind: "SINGLE_ITEM_RECONCILED",
        ...identity,
        openedAt: new Date("2026-09-01T01:00:00Z"),
        retainedProductClassification: "3911210202",
      },
    ]);
  });
  it("never invalidates on missing rows, incomplete pages, missing finality or ambiguous joins", async () => {
    for (const change of [
      (f) => {
        f.getBidPblancListInfoThng.response.body.items = [];
      },
      (f) => {
        f.getBidPblancListInfoThngPurchsObjPrdct.response.body.totalCount =
          "101";
      },
      (f) => {
        f.getScsbidListSttusThng.response.body.items[0].fnlSucsfDate = "";
      },
      (f) => {
        f.getOpengResultListInfoThngPreparPcDetail.response.body.items = [];
      },
      (f) => {
        f.getOpengResultListInfoThngPreparPcDetail.response.body.items[0].bidClsfcNo =
          "2";
      },
    ]) {
      const page = await setup(change, true).adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([]);
    }
  });
});

describe("award evidence completeness and persisted identity regressions", () => {
  it.each(["offset", "page"])(
    "omits colliding classes across %s cursors",
    async (mode) => {
      const { adapter, calls, fixtures } = setup((f) => {
        for (const op of [
          "getBidPblancListInfoThngPurchsObjPrdct",
          "getOpengResultListInfoThngPreparPcDetail",
        ]) {
          const body = f[op].response.body;
          body.items.push({ ...body.items[0], bidClsfcNo: "2" });
          body.totalCount = "2";
        }
        const body = f.getScsbidListSttusThng.response.body;
        if (mode === "offset")
          body.items.push({
            ...body.items[0],
            bidClsfcNo: "2",
            sucsfbidAmt: "999.99",
          });
        body.totalCount = mode === "offset" ? "2" : "101";
      });
      const first = await adapter.fetchWindow(window, null);
      expect(first.items).toEqual([]);
      expect(first.invalidations).toEqual([]);
      expect(first.diagnostics).toContain("AMBIGUOUS_CLASS_IDENTITY");
      expect(first.nextCursor).toBe(mode === "offset" ? "1:1" : "2:0");
      if (mode === "page")
        fixtures.getScsbidListSttusThng.response.body.items[0].bidClsfcNo = "2";
      const second = await adapter.fetchWindow(window, first.nextCursor);
      expect(second.items).toEqual([]);
      expect(second.invalidations).toEqual([]);
      expect(second.diagnostics).toContain("AMBIGUOUS_CLASS_IDENTITY");
      expect(calls).toHaveLength(8);
    },
  );
  it("does not accept a visible final class absent from the allegedly complete purchase/price evidence", async () => {
    const { adapter } = setup((f) => {
      const body = f.getScsbidListSttusThng.response.body;
      body.items.push({ ...body.items[0], bidClsfcNo: "2" });
      body.totalCount = "2";
    });
    const page = await adapter.fetchWindow(window, null);
    expect(page.items).toEqual([]);
    expect(page.invalidations).toEqual([]);
    expect(page.diagnostics).toContain("AMBIGUOUS_CLASS_IDENTITY");
  });
  it.each(["취소공고", "등록공고"])(
    "rejects incomplete detail counts before %s reconciliation",
    async (status) => {
      const { adapter } = setup((f) => {
        const body = f.getBidPblancListInfoThng.response.body;
        body.totalCount = "2";
        body.items[0].ntceKindNm = status;
      }, true);
      const page = await adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([]);
      expect(page.diagnostics).toContain("INCOMPLETE_AWARD_EVIDENCE");
    },
  );
  it.each([
    "getBidPblancListInfoThng",
    "getBidPblancListInfoThngPurchsObjPrdct",
    "getOpengResultListInfoThngPreparPcDetail",
  ])(
    "rejects identity-incomplete rows in %s before inferring uniqueness",
    async (operation) => {
      const { adapter } = setup((f) => {
        const body = f[operation].response.body;
        body.items.push({ ...body.items[0], bidNtceOrd: "" });
        body.totalCount = "2";
        if (operation === "getBidPblancListInfoThng")
          body.items[0].ntceKindNm = "취소공고";
      }, true);
      const page = await adapter.fetchWindow(window, null);
      expect(page.items).toEqual([]);
      expect(page.invalidations).toEqual([]);
      expect(page.diagnostics).toContain("INCOMPLETE_AWARD_EVIDENCE");
    },
  );
});
