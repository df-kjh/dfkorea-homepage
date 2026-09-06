import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { quoteError } from "./quote-policy";

@Injectable()
export class NtsVerifier {
  constructor(private readonly config: ConfigService) {}
  async verify(company: {
    companyName: string;
    businessNumber: string;
    representativeName: string;
    openingDate: string;
  }) {
    const key = this.config.get<string>("NTS_SERVICE_KEY")?.trim();
    // 국세청 공식 스키마: 전달한 선택항목 b_nm까지 모두 일치해야 valid=01이다.
    if (!key)
      quoteError(
        503,
        "NTS_CONFIGURATION",
        "사업자 확인 서비스를 준비 중입니다. 전화 또는 이메일로 문의해 주세요.",
      );
    const url = new URL(
      "https://api.odcloud.kr/api/nts-businessman/v1/validate",
    );
    url.searchParams.set("serviceKey", key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let payload: any;
    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          businesses: [
            {
              b_no: company.businessNumber,
              b_nm: company.companyName.trim(),
              p_nm: company.representativeName.trim(),
              start_dt: company.openingDate.replace(/-/g, ""),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error("NTS_UNAVAILABLE");
      if (!response.body) throw new Error("NTS_EMPTY_RESPONSE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 64 * 1024) throw new Error("NTS_RESPONSE_TOO_LARGE");
          chunks.push(value);
        }
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } finally {
        await reader.cancel();
      }
    } catch {
      quoteError(
        503,
        "NTS_UNAVAILABLE",
        "사업자 확인 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (
      payload?.status_code !== "OK" ||
      !Array.isArray(payload.data) ||
      payload.data.length !== 1 ||
      payload.data[0]?.b_no !== company.businessNumber
    )
      quoteError(
        503,
        "NTS_INVALID_RESPONSE",
        "사업자 확인 응답을 확인할 수 없습니다. 다시 시도해 주세요.",
      );
    const result = payload.data[0];
    if (result.valid === "02")
      quoteError(
        422,
        "BUSINESS_MISMATCH",
        "상호·사업자번호·대표자·개업일자가 일치하지 않습니다. 신규 개업자는 정보 반영에 1~2일이 걸릴 수 있습니다.",
      );
    if (result.valid !== "01" || result.status?.b_no !== company.businessNumber)
      quoteError(
        503,
        "NTS_INVALID_RESPONSE",
        "사업자 확인 응답을 확인할 수 없습니다.",
      );
    if (["02", "03"].includes(result.status.b_stt_cd))
      quoteError(
        422,
        "BUSINESS_INACTIVE",
        "휴업 또는 폐업 사업자는 온라인 견적을 접수할 수 없습니다.",
      );
    if (result.status.b_stt_cd === "")
      quoteError(
        422,
        "BUSINESS_UNREGISTERED",
        "등록된 사업자 정보를 찾을 수 없습니다.",
      );
    if (result.status.b_stt_cd !== "01")
      quoteError(
        503,
        "NTS_INVALID_RESPONSE",
        "사업자 영업 상태를 확인할 수 없습니다.",
      );
    return { verified: true };
  }
}
