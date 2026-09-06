# Explicit G2B pricing fixture provenance

The field names/envelopes follow the official [Public Procurement Service goods notice API](https://www.data.go.kr/data/15129394/openapi.do), `getBidPblancListInfoThng`, `getBidPblancListInfoThngBsisAmount`, restriction and purchase-item operations (embedded Swagger, consulted 2026-09-07). The neighboring `g2b-enrichment.json` preserves the same five operation envelopes and ten attachment slots.

`g2b-enrichment-pricing.json` is a **synthetic schema-shaped example**, not a captured live notice or evidence of production prevalence. It adds the official string `intrbidYn` and sets the already-official string `bidNtceNm` to an explicit total/KRW/no-A-value declaration. No invented currency, contract-kind or A-value API column is used.

| Context fact   | Official evidence                                                                | Acceptance                                                                                                     |
| -------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| TOTAL          | `bidNtceNm` (공고명)                                                             | Explicit 총액 wording, no unit/negated/contradictory wording                                                   |
| KRW            | `bidNtceNm`, `intrbidYn` (국제입찰여부)                                          | Explicit 원화/KRW and domestic `N`; domestic alone is insufficient                                             |
| STANDARD, no A | `bidNtceNm`, `sucsfbidMthdNm`, `prearngPrceDcsnMthdNm`, `rsrvtnPrceReMkngMthdNm` | Explicit A값 미적용, exact 적격심사 and 복수예비가격/복수예가; unknown/special/A-applicable cases are withheld |
| Award method   | `sucsfbidMthdNm` (낙찰방법명)                                                    | Preserved for stored-history matching                                                                          |
| Product group  | Purchase `prdctClsfcNoNm` (물품분류명)                                           | Explicit LED/엘이디/발광다이오드 name; one normalized item                                                     |
| Region         | `prtcptPsblRgnNm`/`prtcptPsblRgnCd`                                              | One normalized region only; absent/multiple regions do not invent a match                                      |
| Basis/range    | `bssamt`, `rsrvtnPrceRngBgnRate`, `rsrvtnPrceRngEndRate`                         | 100,000,000 basis and official -2/+2 offsets, yielding 98/102 absolute percentages                             |

The production adapter supplies safe evidence for accepted context. Parser/orchestrator keep failed sources UNKNOWN/PARTIAL. The service regression uses the real adapter and HTTP-envelope parser plus 15 stored PostgreSQL awards; it never injects `pricingContext`. With lower-limit rate 88%, exact official prices are 86,240,000–89,760,000 and the fixture history estimate is 88,700,052. Unit/foreign/ambiguous/special/unknown-A fixtures remain formula-review-required. Actual notice wording is often insufficient; such live cases remain unpriced until richer official evidence is available.

Pricing title declarations are deliberately parsed as whole clauses separated by parentheses, brackets, commas, semicolons or middle dots. All mentions must be affirmative: `총액입찰`, `원화 KRW`, `A값 미적용` or `A값 미적용 대상` are accepted. Questions (`미적용 여부`), possibility (`미적용 가능`), conditionals, denials and repeated contradictory declarations are withheld for every context fact. Unrecognized free-form grammar also remains unpriced; keywords alone never establish applicability.
