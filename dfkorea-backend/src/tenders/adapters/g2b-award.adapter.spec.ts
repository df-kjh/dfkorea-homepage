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
    adapter: new G2bAwardAdapter(client, { serviceKey: "fixture-key" }),
    calls,
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
