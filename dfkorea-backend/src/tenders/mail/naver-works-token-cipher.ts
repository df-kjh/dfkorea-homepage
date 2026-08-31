import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

@Injectable()
export class NaverWorksTokenCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const encoded = config
      .get<string>("NAVER_WORKS_TOKEN_ENCRYPTION_KEY")
      ?.trim();
    const key = encoded ? Buffer.from(encoded, "base64") : Buffer.alloc(0);
    if (!encoded || key.length !== 32 || key.toString("base64") !== encoded) {
      throw new Error(
        "NAVER_WORKS_TOKEN_ENCRYPTION_KEY must be 32-byte base64",
      );
    }
    this.key = key;
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return ["v1", iv, tag, ciphertext]
      .map((part) =>
        typeof part === "string" ? part : part.toString("base64url"),
      )
      .join(":");
  }

  decrypt(value: string): string {
    try {
      const [version, ivValue, tagValue, ciphertextValue, extra] =
        value.split(":");
      if (
        version !== "v1" ||
        !ivValue ||
        !tagValue ||
        !ciphertextValue ||
        extra
      ) {
        throw new Error("Invalid credential envelope");
      }
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(ivValue, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new Error("NAVER WORKS credential could not be decrypted");
    }
  }
}
