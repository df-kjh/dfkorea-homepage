# G2B goods award contract fixture

Source schemas inspected on 2026-09-07:

- [Official G2B award service](https://www.data.go.kr/data/15129397/openapi.do), embedded Swagger, host `apis.data.go.kr/1230000/as/ScsbidInfoService`.
- [Official G2B notice service](https://www.data.go.kr/data/15129394/openapi.do), embedded Swagger, host `apis.data.go.kr/1230000/ad/BidPublicInfoService`.

`g2b-awards.json` records the complete provider-shaped response fields from those schemas, with constructed anonymous sample values and a hand-calculated monetary example. It is a contract fixture, **not a captured authenticated production response**. Every official item field is included, including empty/unused fields. No real bidder identities or service keys are recorded.

The final goods operation `getScsbidListSttusThng` supplies `sucsfbidAmt`, `sucsfbidRate`, `rlOpengDt`, `fnlSucsfDate`, notice/revision, bid-class and rebid identifiers. It does **not** supply basis amount, planned price, product classification, contract kind or buyer region. `bidClsfcNo` is the bid classification identifier, not a product classification code; `bidwinnrAdrs` is the winning company's address, not a buyer/participation region.

`getOpengResultListInfoThngPreparPcDetail` supplies `bssamt` and `plnprc`, repeated across reserve-price rows. Joins must match notice, revision, bid classification and rebid identifiers and all matching rows must agree on both monetary values.

`getBidPblancListInfoThng` supplies the official notice title, domestic/international flag and award method. `getBidPblancListInfoThngPurchsObjPrdct` supplies the item count, `bidClsfcNo`, and `dtilPrdctClsfcNo`/`dtilPrdctClsfcNoNm`. The positive fixture records `bidClsfcNo: "1"`, matching final and reserve rows. Missing/mismatched bid classification, conflicting detail product code, or a supplied contradictory rebid number must be rejected. The collector admits only explicitly total, domestic, single LED item contracts; missing proof is excluded. Region is deliberately null. Further structured participation-region enrichment is not currently performed.

Money fields remain decimal strings and must fit numeric(20,2); derived ratios use fractional units (`0.998200`, `0.888600`), not percentage units. Ratios that cannot fit numeric(10,6) are null instead of overflowing PostgreSQL. Price analysis derives exact rational ratios again from the original amounts rather than using rounded stored ratios.

Revision reconciliation returns only notice/revision identities and, for a fully observed single-product notice, opened-date and retained product classification. Whole-notice cancellation can invalidate that revision; multi-class changes or multiple active persisted product identities require `AMBIGUOUS_CLASS_IDENTITY` review. Missing rows, incomplete detail pages and failed requests never constitute cancellation. The optional batched tracked-notice resolver uses only stored public notice identities to revisit a previously LED title after it changes, without enriching every unrelated goods row or exceeding the one-list/three-detail HTTP budget.
