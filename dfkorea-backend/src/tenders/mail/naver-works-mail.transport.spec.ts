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
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("access-token"),
    };
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
      const tokenProvider = {
        getAccessToken: jest.fn().mockResolvedValue("token"),
      };
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
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("token"),
    };
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
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("token"),
    };
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
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("token"),
    };
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));
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
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("token"),
    };
    const fetchMock = jest.spyOn(globalThis, "fetch");
    const transport = new NaverWorksMailTransport(invalidConfig, tokenProvider);

    const error = await transport.sendMail(message).catch((reason) => reason);

    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.PERMANENT_REJECTION,
    );
    expect(tokenProvider.getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the documented attachment fields and overrides only the display name", async () => {
    const tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue("token"),
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    const attachment = {
      filename: "현장사진.png",
      fileType: "image/png",
      data: Buffer.from("normalized image").toString("base64"),
    };
    const transport = new NaverWorksMailTransport(config, tokenProvider);
    await transport.sendMail({
      ...message,
      fromName: "DF KOREA 온라인 견적",
      attachments: [attachment],
    } as typeof message);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.attachments).toEqual([attachment]);
    expect(payload.userName).toBe("DF KOREA 온라인 견적");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.worksapis.com/v1.0/users/sender%40dfkorealed.com/mail",
    );
  });

  it("omits the attachment key for an empty attachment list", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    const transport = new NaverWorksMailTransport(config, {
      getAccessToken: async () => "token",
    });
    await transport.sendMail({ ...message, attachments: [] } as typeof message);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body as string),
    ).not.toHaveProperty("attachments");
  });

  const validAttachment = {
    filename: "photo.jpg",
    fileType: "image/jpeg",
    data: "YQ==",
  };
  it.each([
    { fromName: "Sender\r\nBcc: other@example.com" },
    { fromName: " " },
    { fromName: "a".repeat(101) },
    { attachments: [{ ...validAttachment, filename: "../photo.jpg" }] },
    { attachments: [{ ...validAttachment, filename: "folder\\photo.jpg" }] },
    { attachments: [{ ...validAttachment, filename: "photo\u0000.jpg" }] },
    { attachments: [{ ...validAttachment, filename: "." }] },
    { attachments: [{ ...validAttachment, filename: "a".repeat(256) }] },
    {
      attachments: [
        { ...validAttachment, fileType: "image/jpeg\r\nx-header: data" },
      ],
    },
    { attachments: [{ ...validAttachment, fileType: "invalid-mime" }] },
    { attachments: [{ ...validAttachment, data: "!invalid!" }] },
    {
      attachments: [
        { ...validAttachment, data: "data:image/jpeg;base64,YQ==" },
      ],
    },
    { attachments: [{ ...validAttachment, data: "YR==" }] },
    { attachments: [{ ...validAttachment, data: "" }] },
    { attachments: [null] },
    { attachments: "not an array" },
    { attachments: null },
    { attachments: Array(4).fill(validAttachment) },
  ])(
    "rejects malformed mail additions before OAuth or HTTP (%#)",
    async (addition) => {
      const tokenProvider = {
        getAccessToken: jest.fn().mockResolvedValue("token"),
      };
      const fetchMock = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 202 }));
      const transport = new NaverWorksMailTransport(config, tokenProvider);
      const error = await transport
        .sendMail({ ...message, ...addition } as typeof message)
        .catch((reason) => reason);
      expect(classifyMailDeliveryError(error)).toBe(
        MailDeliveryOutcome.PERMANENT_REJECTION,
      );
      expect(tokenProvider.getAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized decoded attachment before transmission", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    const transport = new NaverWorksMailTransport(config, {
      getAccessToken: async () => "token",
    });
    const error = await transport
      .sendMail({
        ...message,
        attachments: [
          {
            ...validAttachment,
            data: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
          },
        ],
      } as typeof message)
      .catch((reason) => reason);
    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.PERMANENT_REJECTION,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts three attachments at the 2 MiB per-file and 6 MiB total boundary", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    const transport = new NaverWorksMailTransport(config, {
      getAccessToken: async () => "token",
    });
    const attachments = [1, 2, 3].map((i) => ({
      ...validAttachment,
      filename: `photo-${i}.jpg`,
      data: Buffer.alloc(2 * 1024 * 1024, i).toString("base64"),
    }));
    await expect(
      transport.sendMail({ ...message, attachments }),
    ).resolves.toEqual({ providerMessageId: null });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body as string).attachments,
    ).toEqual(attachments);
  });

  it.each([200, 500, 503])(
    "retains an ambiguous HTTP %s outcome with attachments",
    async (status) => {
      const fetchMock = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status }));
      const transport = new NaverWorksMailTransport(config, {
        getAccessToken: async () => "token",
      });
      const error = await transport
        .sendMail({
          ...message,
          attachments: [validAttachment],
        } as typeof message)
        .catch((reason) => reason);
      expect(classifyMailDeliveryError(error)).toBe(
        MailDeliveryOutcome.UNKNOWN_ACCEPTANCE,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("reuses the identical attachment body after a single 401 refresh and permanently rejects a second 401", async () => {
    const tokenProvider = {
      getAccessToken: jest
        .fn()
        .mockResolvedValueOnce("old")
        .mockResolvedValueOnce("new"),
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    const transport = new NaverWorksMailTransport(config, tokenProvider);
    const error = await transport
      .sendMail({
        ...message,
        attachments: [validAttachment],
      } as typeof message)
      .catch((reason) => reason);
    expect(classifyMailDeliveryError(error)).toBe(
      MailDeliveryOutcome.PERMANENT_REJECTION,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(
      fetchMock.mock.calls[1][1].body,
    );
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body as string).attachments,
    ).toEqual([validAttachment]);
  });
});
