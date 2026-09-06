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

export interface MailAttachment {
  filename: string;
  fileType: string;
  data: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  attachments?: MailAttachment[];
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
    this.validateAdditions(message);
    const body = JSON.stringify({
      to: message.to,
      subject: message.subject,
      body: message.html,
      contentType: "html",
      userName: message.fromName ?? configuration.fromName,
      isSaveSentMail: true,
      isSaveTracking: true,
      isSendSeparately: false,
      // 빈 배열도 생략하여 기존 입찰 메일의 요청 payload를 그대로 유지한다.
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map(
              ({ filename, fileType, data }) => ({ filename, fileType, data }),
            ),
          }
        : {}),
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
    // NAVER WORKS Mail API는 멱등 키를 제공하지 않는다. 5xx도 수락 후 발생할 수 있으므로
    // 자동 재시도로 중복 발송하지 않고 수락 여부 불명 상태를 유지한다.
    throw new MailDeliveryError(MailDeliveryOutcome.UNKNOWN_ACCEPTANCE);
  }

  private validateAdditions(message: MailMessage): void {
    const reject = (): never => {
      throw new MailDeliveryError(MailDeliveryOutcome.PERMANENT_REJECTION);
    };
    if (
      message.fromName !== undefined &&
      (typeof message.fromName !== "string" ||
        !message.fromName.trim() ||
        message.fromName.length > 100 ||
        /[\u0000-\u001f\u007f]/.test(message.fromName))
    )
      reject();
    if (message.attachments === undefined) return;
    if (!Array.isArray(message.attachments) || message.attachments.length > 3)
      reject();
    const maxFileBytes = 2 * 1024 * 1024;
    let totalBytes = 0;
    for (const attachment of message.attachments) {
      if (!attachment || typeof attachment !== "object") reject();
      const { filename, fileType, data } = attachment;
      if (
        typeof filename !== "string" ||
        !filename.trim() ||
        filename === "." ||
        filename === ".." ||
        Buffer.byteLength(filename, "utf8") > 255 ||
        /[\u0000-\u001f\u007f/\\:<>"|?*]/.test(filename)
      )
        reject();
      if (
        typeof fileType !== "string" ||
        fileType.length > 127 ||
        !/^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/.test(
          fileType,
        )
      )
        reject();
      // Buffer.from은 잘못된 Base64도 관대하게 디코딩하므로 크기를 먼저 제한하고 정규 형식과 왕복 결과를 함께 검증한다.
      if (
        typeof data !== "string" ||
        !data.length ||
        data.length > 4 * Math.ceil(maxFileBytes / 3) ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          data,
        )
      )
        reject();
      const decoded = Buffer.from(data, "base64");
      if (decoded.length > maxFileBytes || decoded.toString("base64") !== data)
        reject();
      totalBytes += decoded.length;
      if (totalBytes > 6 * 1024 * 1024) reject();
    }
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
    const timeout = setTimeout(
      () => controller.abort(),
      configuration.timeoutMs,
    );
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
      this.config.get<string>("NAVER_WORKS_FROM_NAME") ?? "DF KOREA 입찰정보";
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
