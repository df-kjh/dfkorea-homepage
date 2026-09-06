import { HttpException } from "@nestjs/common";
import { createHash } from "crypto";
import {
  classifyMailDeliveryError,
  MailDeliveryOutcome,
} from "../tenders/mail/mail-delivery-outcome";

export const quoteError = (
  status: number,
  code: string,
  message: string,
): never => {
  throw new HttpException({ statusCode: status, code, message }, status);
};
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const submissionHash = (value: unknown) =>
  tokenHash(JSON.stringify(canonical(value)));
export const businessHash = (company: {
  companyName: string;
  businessNumber: string;
  representativeName: string;
  openingDate: string;
}) =>
  submissionHash({
    companyName: company.companyName.trim(),
    businessNumber: company.businessNumber,
    representativeName: company.representativeName.trim(),
    openingDate: company.openingDate,
  });
export function assertVerification(
  verification: any,
  sessionId: string,
  company: Parameters<typeof businessHash>[0],
  now = new Date(),
) {
  if (
    !verification ||
    verification.session_id !== sessionId ||
    verification.input_hash !== businessHash(company)
  )
    quoteError(
      422,
      "VERIFICATION_MISMATCH",
      "사업자 정보를 다시 확인해 주세요.",
    );
  if (new Date(verification.expires_at) <= now)
    quoteError(
      410,
      "VERIFICATION_EXPIRED",
      "사업자 확인 유효시간이 지났습니다. 다시 확인해 주세요.",
    );
}
export function assertAttachmentOwnership(
  attachment: any,
  sessionId: string,
  now = new Date(),
) {
  if (
    !attachment ||
    attachment.session_id !== sessionId ||
    attachment.request_id ||
    attachment.state !== "READY" ||
    new Date(attachment.expires_at) <= now
  )
    quoteError(
      422,
      "INVALID_ATTACHMENT",
      "사용할 수 없는 첨부 사진입니다. 다시 선택해 주세요.",
    );
}
export function assertOrigin(
  origin: string | undefined,
  configured: string | undefined,
) {
  const allowed =
    configured
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (
    !allowed.length ||
    allowed.some((value) => {
      try {
        const url = new URL(value);
        return (
          url.origin !== value || !["http:", "https:"].includes(url.protocol)
        );
      } catch {
        return true;
      }
    })
  )
    quoteError(
      503,
      "QUOTE_CONFIGURATION",
      "온라인 견적 연결 설정을 확인하고 있습니다. 전화 또는 이메일로 문의해 주세요.",
    );
  if (!origin || !allowed.includes(origin))
    quoteError(403, "INVALID_ORIGIN", "허용되지 않은 요청입니다.");
}
export function idempotentReference(
  existing: { payload_hash: string; reference: string },
  hash: string,
) {
  if (existing.payload_hash !== hash)
    quoteError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "같은 재시도 키로 다른 내용을 보낼 수 없습니다.",
    );
  return existing.reference;
}
export function deliveryFailure(error: unknown, attempt: number) {
  const outcome = classifyMailDeliveryError(error);
  const delayMinutes =
    outcome === MailDeliveryOutcome.RETRYABLE_REJECTION
      ? ([1, 5, 30][attempt - 1] ?? null)
      : null;
  return {
    status:
      outcome === MailDeliveryOutcome.UNKNOWN_ACCEPTANCE
        ? "DELIVERY_UNCERTAIN"
        : delayMinutes !== null
          ? "PENDING"
          : "FAILED",
    delayMinutes,
    errorCode: outcome,
  };
}
export const privacyConfiguration = (config: { get<T>(key: string): T }) => {
  const retentionDays = Number(
    config.get<string>("QUOTE_RETENTION_DAYS") || "365",
  );
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 3650
  )
    quoteError(
      503,
      "QUOTE_CONFIGURATION",
      "개인정보 보유기간 설정을 확인해 주세요.",
    );
  return { version: `quote-2026-09-v2-email-photos-${retentionDays}d`, retentionDays };
};
