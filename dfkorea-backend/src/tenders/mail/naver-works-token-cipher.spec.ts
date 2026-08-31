import { ConfigService } from "@nestjs/config";
import { NaverWorksTokenCipher } from "./naver-works-token-cipher";

describe("NaverWorksTokenCipher", () => {
  const key = Buffer.alloc(32, 7).toString("base64");

  it("round-trips a token without storing the plaintext", () => {
    const cipher = new NaverWorksTokenCipher(
      new ConfigService({ NAVER_WORKS_TOKEN_ENCRYPTION_KEY: key }),
    );

    const encrypted = cipher.encrypt("refresh-secret");

    expect(encrypted).not.toContain("refresh-secret");
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(cipher.decrypt(encrypted)).toBe("refresh-secret");
  });

  it("rejects a modified encrypted token", () => {
    const cipher = new NaverWorksTokenCipher(
      new ConfigService({ NAVER_WORKS_TOKEN_ENCRYPTION_KEY: key }),
    );
    const encrypted = cipher.encrypt("refresh-secret");
    const parts = encrypted.split(":");
    parts[3] = `${parts[3].startsWith("A") ? "B" : "A"}${parts[3].slice(1)}`;
    const modified = parts.join(":");

    expect(() => cipher.decrypt(modified)).toThrow(
      "NAVER WORKS credential could not be decrypted",
    );
  });

  it("requires one dedicated 32-byte base64 key", () => {
    expect(
      () =>
        new NaverWorksTokenCipher(
          new ConfigService({ NAVER_WORKS_TOKEN_ENCRYPTION_KEY: "short" }),
        ),
    ).toThrow("NAVER_WORKS_TOKEN_ENCRYPTION_KEY must be 32-byte base64");
  });
});
