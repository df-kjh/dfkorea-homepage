import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "./mail-delivery-outcome";

interface AccessTokenProvider {
  getAccessToken(
    forceRefresh: boolean,
    now?: Date,
    rejectedAccessToken?: string,
  ): Promise<string>;
}

interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class NaverWorksMailTransport {
  constructor(
    private readonly config: ConfigService,
    private readonly tokenProvider: AccessTokenProvider,
  ) {}

  async sendMail(
    message: MailMessage,
  ): Promise<{ providerMessageId: string | null }> {
    const configuration = this.getConfiguration();
    const body = JSON.stringify({
      to: message.to,
      subject: message.subject,
      body: message.html,
      contentType: "html",
      userName: configuration.fromName,
      isSaveSentMail: true,
      isSaveTracking: true,
      isSendSeparately: false,
    });
    let accessToken = await this.tokenProvider.getAccessToken(false);
    let response = await this.request(configuration, accessToken, body);
    if (response.status === 401) {
      accessToken = await this.tokenProvider.getAccessToken(
        true,
        undefined,
        accessToken,
      );
      response = await this.request(configuration, accessToken, body);
    }
    if (response.status === 202) return { providerMessageId: null };
    if (response.status === 429) {
      throw new MailDeliveryError(MailDeliveryOutcome.RETRYABLE_REJECTION);
    }
    if (response.status >= 400 && response.status < 500) {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    // NAVER WORKS does not document an idempotency key for Mail API calls.
    // A 5xx can arrive after the provider accepted the message, so a retry
    // could duplicate mail. Preserve the ambiguity instead.
    throw new MailDeliveryError(MailDeliveryOutcome.UNKNOWN_ACCEPTANCE);
  }

  private async request(
    configuration: {
      endpoint: string;
      timeoutMs: number;
    },
    accessToken: string,
    body: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
    try {
      return await fetch(configuration.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.UNKNOWN_ACCEPTANCE);
    } finally {
      clearTimeout(timeout);
    }
  }

  private getConfiguration(): {
    endpoint: string;
    fromName: string;
    timeoutMs: number;
  } {
    const baseUrl =
      this.config.get<string>("NAVER_WORKS_API_BASE_URL") ??
      "https://www.worksapis.com/v1.0";
    const senderUserId = this.config
      .get<string>("NAVER_WORKS_SENDER_USER_ID")
      ?.trim();
    const fromName =
      this.config.get<string>("NAVER_WORKS_FROM_NAME") ??
      "DF KOREA 입찰정보";
    const timeoutMs = Number(
      this.config.get<string>("NAVER_WORKS_HTTP_TIMEOUT_MS") ?? "10000",
    );
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    if (
      parsedBaseUrl.protocol !== "https:" ||
      parsedBaseUrl.hostname !== "www.worksapis.com" ||
      !senderUserId ||
      !isEmail(senderUserId) ||
      /[\r\n]/.test(fromName) ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 30000
    ) {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    }
    const normalizedBaseUrl = parsedBaseUrl.toString().replace(/\/$/, "");
    return {
      endpoint: `${normalizedBaseUrl}/users/${encodeURIComponent(senderUserId)}/mail`,
      fromName,
      timeoutMs,
    };
  }
}
