import {
  businessHash,
  assertVerification,
  assertAttachmentOwnership,
  assertOrigin,
  submissionHash,
  idempotentReference,
  deliveryFailure,
} from "./quote-policy";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../tenders/mail/mail-delivery-outcome";

const company = {
  companyName: "테스트상호",
  businessNumber: "1234567890",
  representativeName: "대표",
  openingDate: "2020-01-01",
};
describe("quote trust boundaries", () => {
  const now = new Date("2026-09-06T00:00:00Z");
  const verification = {
    session_id: "session-a",
    input_hash: businessHash(company),
    expires_at: new Date(now.getTime() + 1000),
  };
  it("requires matching company snapshot, owner and unexpired verification", () => {
    expect(() =>
      assertVerification(verification, "session-a", company, now),
    ).not.toThrow();
    expect(() =>
      assertVerification(verification, "session-b", company, now),
    ).toThrow();
    expect(() =>
      assertVerification(
        verification,
        "session-a",
        { ...company, companyName: "다른상호" },
        now,
      ),
    ).toThrow();
    expect(() =>
      assertVerification(
        verification,
        "session-a",
        company,
        new Date(now.getTime() + 1000),
      ),
    ).toThrow();
  });
  it("denies foreign, submitted or expired attachments", () => {
    const attachment = {
      session_id: "a",
      request_id: null,
      state: "READY",
      expires_at: new Date(now.getTime() + 1000),
    };
    expect(() => assertAttachmentOwnership(attachment, "a", now)).not.toThrow();
    for (const change of [
      { session_id: "b" },
      { request_id: "submitted" },
      { state: "UPLOADING" },
      { expires_at: now },
    ]) {
      expect(() =>
        assertAttachmentOwnership({ ...attachment, ...change }, "a", now),
      ).toThrow();
    }
  });
  it("requires exact origin and fails closed for absent configuration", () => {
    expect(() =>
      assertOrigin("https://dfkorealed.com", "https://dfkorealed.com"),
    ).not.toThrow();
    for (const origin of [
      undefined,
      "null",
      "https://evil.vercel.app",
      "https://dfkorealed.com.evil.test",
    ]) {
      expect(() => assertOrigin(origin, "https://dfkorealed.com")).toThrow();
    }
    expect(() => assertOrigin("https://dfkorealed.com", "")).toThrow();
  });
  it("replays identical submissions and rejects changed payload", () => {
    const first = submissionHash({ company, items: [{ quantity: 1 }] });
    expect(submissionHash({ items: [{ quantity: 1 }], company })).toBe(first);
    expect(
      idempotentReference(
        { payload_hash: first, reference: "Q-reference" },
        first,
      ),
    ).toBe("Q-reference");
    expect(() =>
      idempotentReference(
        { payload_hash: first, reference: "Q-reference" },
        submissionHash({ company, items: [{ quantity: 2 }] }),
      ),
    ).toThrow();
  });
  it("never automatically retries ambiguous acceptance and only retries explicit rejection three times", () => {
    expect(deliveryFailure(new Error("socket closed"), 1)).toEqual({
      status: "DELIVERY_UNCERTAIN",
      delayMinutes: null,
      errorCode: "UNKNOWN_ACCEPTANCE",
    });
    const retryable = new MailDeliveryError(
      MailDeliveryOutcome.RETRYABLE_REJECTION,
    );
    expect(
      [1, 2, 3, 4].map(
        (attempt) => deliveryFailure(retryable, attempt).delayMinutes,
      ),
    ).toEqual([1, 5, 30, null]);
    expect(deliveryFailure(retryable, 4).status).toBe("FAILED");
  });
});
