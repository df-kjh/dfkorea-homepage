import { MigrationInterface, QueryRunner } from "typeorm";
export class AddQuoteAttachmentPayloads1788652900000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // 기존 R2/로컬 객체는 이관하지 않는다. 기존 메타데이터만 있는 사진은 명시적으로 사용불가 처리된다.
    await runner.query(`CREATE TABLE quote_attachment_payloads (
      attachment_id uuid PRIMARY KEY REFERENCES quote_attachments(id) ON DELETE CASCADE,
      bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 2097152),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX quote_attachment_payload_expiry_idx ON quote_attachment_payloads(expires_at);`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE quote_attachment_payloads");
  }
}
