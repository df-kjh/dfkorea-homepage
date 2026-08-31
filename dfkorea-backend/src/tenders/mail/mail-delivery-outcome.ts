export enum MailDeliveryOutcome {
  RETRYABLE_REJECTION = "RETRYABLE_REJECTION",
  PERMANENT_REJECTION = "PERMANENT_REJECTION",
  UNKNOWN_ACCEPTANCE = "UNKNOWN_ACCEPTANCE",
}

export class MailDeliveryError extends Error {
  constructor(public readonly outcome: MailDeliveryOutcome) {
    super("Mail provider request failed");
    this.name = "MailDeliveryError";
  }
}

export const classifyMailDeliveryError = (
  error: unknown,
): MailDeliveryOutcome =>
  error instanceof MailDeliveryError
    ? error.outcome
    : MailDeliveryOutcome.UNKNOWN_ACCEPTANCE;
