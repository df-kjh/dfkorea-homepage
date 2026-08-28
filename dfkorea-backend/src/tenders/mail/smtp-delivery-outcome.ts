export enum SmtpDeliveryOutcome {
  CONFIRMED_FAILURE = "CONFIRMED_FAILURE",
  DELIVERY_UNCERTAIN = "DELIVERY_UNCERTAIN",
}

interface NodemailerTransportError {
  responseCode?: unknown;
  rejected?: unknown;
}

const isTransportError = (error: unknown): error is NodemailerTransportError =>
  typeof error === "object" && error !== null;

export const classifySmtpTransportError = (
  error: unknown,
): SmtpDeliveryOutcome => {
  if (!isTransportError(error)) return SmtpDeliveryOutcome.DELIVERY_UNCERTAIN;

  const responseCode =
    typeof error.responseCode === "number" ? error.responseCode : undefined;
  if (responseCode && responseCode >= 400 && responseCode <= 599) {
    // A 4xx/5xx SMTP response proves that this attempt was rejected. The
    // command may be "AUTH PLAIN"/"AUTH LOGIN" rather than exactly "AUTH".
    return SmtpDeliveryOutcome.CONFIRMED_FAILURE;
  }

  if (Array.isArray(error.rejected) && error.rejected.length > 0) {
    return SmtpDeliveryOutcome.CONFIRMED_FAILURE;
  }

  // Nodemailer does not expose a phase-proof acceptance boundary for socket
  // errors. In particular, command=CONN is still observed for connection
  // timeouts after transport setup, so code/command alone must never trigger a
  // resend. This deliberately prefers a rare missed mail over a duplicate.
  return SmtpDeliveryOutcome.DELIVERY_UNCERTAIN;
};
