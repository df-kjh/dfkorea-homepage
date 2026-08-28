import {
  classifySmtpTransportError,
  SmtpDeliveryOutcome,
} from "./smtp-delivery-outcome";

describe("SMTP transport outcome classifier", () => {
  it.each([
    { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 },
    { code: "EAUTH", command: "AUTH LOGIN", responseCode: 535 },
    { code: "EENVELOPE", command: "RCPT TO", responseCode: 550 },
    { responseCode: 451, command: "DATA" },
    { rejected: ["recipient@example.com"], command: "RCPT TO" },
  ])("retries only a confirmed pre-acceptance failure %#", (error) => {
    expect(classifySmtpTransportError(error)).toBe(
      SmtpDeliveryOutcome.CONFIRMED_FAILURE,
    );
  });

  it.each([
    { code: "ETIMEDOUT", command: "CONN" },
    { code: "ECONNECTION", command: "CONN" },
    { code: "ECONNRESET", command: "CONN" },
    { code: "ESOCKET", command: "CONN" },
    { code: "ETIMEDOUT", command: "DATA" },
    { code: "ECONNRESET", command: "DATA" },
    { code: "ETIMEDOUT" },
    new Error("unknown transport failure"),
  ])("conservatively marks ambiguous acceptance %#", (error) => {
    expect(classifySmtpTransportError(error)).toBe(
      SmtpDeliveryOutcome.DELIVERY_UNCERTAIN,
    );
  });
});
