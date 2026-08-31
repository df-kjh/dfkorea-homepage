import { ConfigService } from "@nestjs/config";
import {
  MailDeliveryOutcome,
  classifyMailDeliveryError,
} from "./mail-delivery-outcome";
import { NaverWorksMailTransport } from "./naver-works-mail.transport";

describe("NaverWorksMailTransport", () => {
  const config = new ConfigService({
    NAVER_WORKS_API_BASE_URL: "https://www.worksapis.com/v1.0",
    NAVER_WORKS_SENDER_USER_ID: "sender@dfkorealed.com",
    NAVER_WORKS_FROM_NAME: "DF KOREA 입찰정보",
    NAVER_WORKS_HTTP_TIMEOUT_MS: "5000",
  });
  const message = {
    to: "recipient@example.com",
    subject: "신규 공고",
    html: "<p>공고</p>",
    text: "공고",
  };

  afterEach(() => jest.restoreAllMocks());

  it("accepts only the documented HTTP 202 response", async () => {
    const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("access-token") };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    const transport = new NaverWorksMailTransport(config, tokenProvider);

    await expect(transport.sendMail(message)).resolves.toEqual({
      providerMessageId: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.worksapis.com/v1.0/users/sender%40dfkorealed.com/mail",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "recipient@example.com",
          subject: "신규 공고",
          body: "<p>공고</p>",
          contentType: "html",
          userName: "DF KOREA 입찰정보",
          isSaveSentMail: true,
          isSaveTracking: true,
          isSendSeparately: false,
        }),
      }),
    );
  });

  it("refreshes once after a rejected access token and retries the same request", async () => {
    const tokenProvider = {
      getAccessToken: jest
        .fn()
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("refreshed-token"),
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const transport = new NaverWorksMailTransport(config, tokenProvider);

    await expect(transport.sendMail(message)).resolves.toEqual({
      providerMessageId: null,
    });
    expect(tokenProvider.getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(tokenProvider.getAccessToken).toHaveBeenNthCalledWith(
      2,
      true,
      undefined,
      "expired-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403])(
    "classifies HTTP %s as a permanent rejection",
    async (status) => {
      const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("token") };
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status }));
      const transport = new NaverWorksMailTransport(config, tokenProvider);

      const error = await transport.sendMail(message).catch((reason) => reason);

      expect(classifyMailDeliveryError(error)).toBe(
        MailDeliveryOutcome.PERMANENT_REJECTION,
      );
      expect(String(error)).not.toContain("token");
    },
  );

  it("classifies HTTP 429 as retryable", async () => {
    const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("token") };
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 429 }));
    const transport = new NaverWorksMailTransport(config, tokenProvider);

    const error = await transport.sendMail(message).catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.RETRYABLE_REJECTION,
    );
  });

  it("treats an undocumented provider 5xx as an unknown acceptance outcome", async () => {
    const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("token") };
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 500 }));
    const transport = new NaverWorksMailTransport(config, tokenProvider);

    const error = await transport.sendMail(message).catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.UNKNOWN_ACCEPTANCE,
    );
  });

  it("does not retry when the provider acceptance outcome is unknown", async () => {
    const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("token") };
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const transport = new NaverWorksMailTransport(config, tokenProvider);

    const error = await transport.sendMail(message).catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.UNKNOWN_ACCEPTANCE,
    );
  });

  it("rejects an invalid sender identity before making an HTTP request", async () => {
    const invalidConfig = new ConfigService({
      NAVER_WORKS_SENDER_USER_ID: "sender@example.com,other@example.com",
    });
    const tokenProvider = { getAccessToken: jest.fn().mockResolvedValue("token") };
    const fetchMock = jest.spyOn(globalThis, "fetch");
    const transport = new NaverWorksMailTransport(invalidConfig, tokenProvider);

    const error = await transport.sendMail(message).catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.PERMANENT_REJECTION,
    );
    expect(tokenProvider.getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
