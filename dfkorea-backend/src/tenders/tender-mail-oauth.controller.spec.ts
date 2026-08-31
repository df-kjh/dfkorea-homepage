import type { Response } from "express";
import { TenderMailOAuthController } from "./tender-mail-oauth.controller";

describe("TenderMailOAuthController", () => {
  const oauth = {
    beginAuthorization: jest
      .fn()
      .mockResolvedValue("https://auth.worksmobile.com/authorize"),
    completeAuthorization: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({
      connected: true,
      connectedAt: new Date("2026-08-31T00:00:00.000Z"),
      accessTokenExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
    }),
  };
  const controller = new TenderMailOAuthController(oauth as never, {
    get: jest.fn().mockReturnValue("https://www.dfkorealed.com"),
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it("returns the authorization URL to an authenticated admin caller", async () => {
    await expect(controller.authorize()).resolves.toEqual({
      authorizationUrl: "https://auth.worksmobile.com/authorize",
    });
  });

  it("returns connection status without exposing tokens", async () => {
    await expect(controller.status()).resolves.toEqual({
      connected: true,
      connectedAt: new Date("2026-08-31T00:00:00.000Z"),
      accessTokenExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("completes a valid callback and redirects without putting tokens in the URL", async () => {
    const response = { redirect: jest.fn() } as unknown as Response;

    await controller.callback("code-value", "state-value", response);

    expect(oauth.completeAuthorization).toHaveBeenCalledWith(
      "code-value",
      "state-value",
    );
    expect(response.redirect).toHaveBeenCalledWith(
      "https://www.dfkorealed.com/admin/dashboard?tab=tenders&mailOAuth=connected",
    );
  });

  it("validates the public redirect before consuming an authorization code", async () => {
    const invalidController = new TenderMailOAuthController(oauth as never, {
      get: jest.fn().mockReturnValue("not-a-url"),
    } as never);

    await expect(
      invalidController.callback("code-value", "state-value", {
        redirect: jest.fn(),
      } as unknown as Response),
    ).rejects.toThrow("PUBLIC_SITE_URL is invalid");
    expect(oauth.completeAuthorization).not.toHaveBeenCalled();
  });
});
