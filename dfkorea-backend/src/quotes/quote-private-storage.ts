import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

export class QuotePayloadUnavailableError extends Error {
  constructor() {
    super("ATTACHMENT_PAYLOAD_UNAVAILABLE");
    this.name = "QuotePayloadUnavailableError";
  }
}
export const QUOTE_PHOTO_RETENTION_DAYS = 7;

// 기존 메타데이터의 비공개 저장 식별자는 유지하지만 실제 사진은 별도 DB payload에만 보관한다.
@Injectable()
export class QuotePrivateStorage {
  constructor(private readonly db: DataSource) {}
  private attachmentId(key: string) {
    const id = /^quote\/([a-f0-9-]{36})\.jpg$/.exec(key)?.[1];
    if (!id) throw new QuotePayloadUnavailableError();
    return id;
  }
  async put(key: string, bytes: Buffer) {
    const id = this.attachmentId(key);
    if (!bytes.length || bytes.length > 2 * 1024 * 1024)
      throw new QuotePayloadUnavailableError();
    await this.db.transaction(async (manager) => {
      const [photo] = await manager.query(
        "SELECT id,expires_at FROM quote_attachments WHERE id=$1 AND state='UPLOADING' AND request_id IS NULL AND expires_at>now() FOR UPDATE",
        [id],
      );
      if (!photo) throw new QuotePayloadUnavailableError();
      // 재시도로 bytes를 바꾸어 쓰더라도 최초 업로드 만료시각은 연장하지 않는다.
      await manager.query(
        "INSERT INTO quote_attachment_payloads(attachment_id,bytes,expires_at) VALUES($1,$2,$3) ON CONFLICT(attachment_id) DO UPDATE SET bytes=EXCLUDED.bytes",
        [id, bytes, photo.expires_at],
      );
    });
  }
  async read(key: string): Promise<Buffer> {
    const [payload] = await this.db.query(
      "SELECT bytes FROM quote_attachment_payloads WHERE attachment_id=$1 AND expires_at>now()",
      [this.attachmentId(key)],
    );
    if (!payload) throw new QuotePayloadUnavailableError();
    return payload.bytes;
  }
  async assertAvailable(
    attachmentIds: string[],
    manager: EntityManager = this.db.manager,
  ) {
    if (!attachmentIds.length) return;
    const rows = await manager.query(
      "SELECT attachment_id FROM quote_attachment_payloads WHERE attachment_id=ANY($1::uuid[]) AND expires_at>now() FOR SHARE",
      [attachmentIds],
    );
    if (rows.length !== attachmentIds.length)
      throw new QuotePayloadUnavailableError();
  }
}
