export enum SmtpDeliveryOutcome {
  CONFIRMED_FAILURE = "CONFIRMED_FAILURE",
  DELIVERY_UNCERTAIN = "DELIVERY_UNCERTAIN",
}

interface NodemailerTransportError {
  code?: unknown;
  command?: unknown;
  responseCode?: unknown;
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
    // An explicit SMTP negative response proves the server did not accept DATA.
    return SmtpDeliveryOutcome.CONFIRMED_FAILURE;
  }

  const command =
    typeof error.command === "string" ? error.command.toUpperCase() : "";
  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  const preDataCommand = ["CONN", "AUTH", "MAIL FROM", "RCPT TO"].includes(
    command,
  );
  const preDataFailure = [
    "EAUTH",
    "ECONNECTION",
    "ETIMEDOUT",
    "ECONNRESET",
    "EENVELOPE",
  ].includes(code);

  return preDataCommand && preDataFailure
    ? SmtpDeliveryOutcome.CONFIRMED_FAILURE
    : SmtpDeliveryOutcome.DELIVERY_UNCERTAIN;
};
