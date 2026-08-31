import { MigrationInterface, QueryRunner } from "typeorm";

export class UseNaverWorksMailApi1787820200000
  implements MigrationInterface
{
  name = "UseNaverWorksMailApi1787820200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("tender_mail_deliveries")) {
      const hasLegacy = await queryRunner.hasColumn(
        "tender_mail_deliveries",
        "smtpMessageId",
      );
      const hasCanonical = await queryRunner.hasColumn(
        "tender_mail_deliveries",
        "providerMessageId",
      );
      if (hasLegacy && !hasCanonical) {
        await queryRunner.query(
          'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "providerMessageId" varchar',
        );
      }
      if (hasLegacy) {
        await queryRunner.query(
          'UPDATE "tender_mail_deliveries" SET "providerMessageId" = COALESCE("providerMessageId", "smtpMessageId") WHERE "providerMessageId" IS NULL',
        );
        await queryRunner.query(
          `CREATE OR REPLACE FUNCTION sync_tender_mail_message_ids() RETURNS trigger AS $$
          BEGIN
            IF NEW."providerMessageId" IS DISTINCT FROM OLD."providerMessageId" THEN
              NEW."smtpMessageId" := NEW."providerMessageId";
            ELSIF NEW."smtpMessageId" IS DISTINCT FROM OLD."smtpMessageId" THEN
              NEW."providerMessageId" := NEW."smtpMessageId";
            ELSE
              NEW."providerMessageId" := COALESCE(NEW."providerMessageId", NEW."smtpMessageId");
              NEW."smtpMessageId" := COALESCE(NEW."smtpMessageId", NEW."providerMessageId");
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql`,
        );
        await queryRunner.query(
          `DROP TRIGGER IF EXISTS "TR_sync_tender_mail_message_ids" ON "tender_mail_deliveries"`,
        );
        await queryRunner.query(
          `CREATE TRIGGER "TR_sync_tender_mail_message_ids" BEFORE INSERT OR UPDATE ON "tender_mail_deliveries" FOR EACH ROW EXECUTE FUNCTION sync_tender_mail_message_ids()`,
        );
      } else if (!hasCanonical) {
        await queryRunner.query(
          'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "providerMessageId" varchar',
        );
      }
    }

    if (!(await queryRunner.hasTable("tender_mail_oauth_credentials"))) {
      await queryRunner.query(`
        CREATE TABLE "tender_mail_oauth_credentials" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "singletonKey" varchar(32) NOT NULL DEFAULT 'naver-works',
          "provider" varchar(32) NOT NULL DEFAULT 'NAVER_WORKS',
          "accessTokenEncrypted" text,
          "refreshTokenEncrypted" text,
          "accessTokenExpiresAt" timestamptz,
          "scope" varchar,
          "oauthStateHash" varchar(64),
          "oauthStateExpiresAt" timestamptz,
          "connectedAt" timestamptz,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_tender_mail_oauth_credentials" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_tender_mail_oauth_credential_singleton_key" UNIQUE ("singletonKey")
        )
      `);
      return;
    }

    const canonicalColumns: Array<[string, string]> = [
      ["id", "uuid NOT NULL DEFAULT uuid_generate_v4()"],
      ["singletonKey", "varchar(32) NOT NULL DEFAULT 'naver-works'"],
      ["provider", "varchar(32) NOT NULL DEFAULT 'NAVER_WORKS'"],
      ["accessTokenEncrypted", "text"],
      ["refreshTokenEncrypted", "text"],
      ["accessTokenExpiresAt", "timestamptz"],
      ["scope", "varchar"],
      ["oauthStateHash", "varchar(64)"],
      ["oauthStateExpiresAt", "timestamptz"],
      ["connectedAt", "timestamptz"],
      ["createdAt", "timestamptz NOT NULL DEFAULT now()"],
      ["updatedAt", "timestamptz NOT NULL DEFAULT now()"],
    ];
    for (const [column, definition] of canonicalColumns) {
      if (
        !(await queryRunner.hasColumn(
          "tender_mail_oauth_credentials",
          column,
        ))
      ) {
        await queryRunner.query(
          `ALTER TABLE "tender_mail_oauth_credentials" ADD COLUMN "${column}" ${definition}`,
        );
      }
    }
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'PK_tender_mail_oauth_credentials'
        ) THEN
          ALTER TABLE "tender_mail_oauth_credentials"
          ADD CONSTRAINT "PK_tender_mail_oauth_credentials" PRIMARY KEY ("id");
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_tender_mail_oauth_credential_singleton_key'
        ) THEN
          ALTER TABLE "tender_mail_oauth_credentials"
          ADD CONSTRAINT "UQ_tender_mail_oauth_credential_singleton_key" UNIQUE ("singletonKey");
        END IF;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("tender_mail_deliveries")) {
      const hasLegacy = await queryRunner.hasColumn(
        "tender_mail_deliveries",
        "smtpMessageId",
      );
      const hasCanonical = await queryRunner.hasColumn(
        "tender_mail_deliveries",
        "providerMessageId",
      );
      if (!hasLegacy) {
        await queryRunner.query(
          'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "smtpMessageId" varchar',
        );
      }
      if (hasCanonical) {
        await queryRunner.query(
          'UPDATE "tender_mail_deliveries" SET "smtpMessageId" = COALESCE("smtpMessageId", "providerMessageId") WHERE "smtpMessageId" IS NULL',
        );
      }
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "TR_sync_tender_mail_message_ids" ON "tender_mail_deliveries"`,
      );
      await queryRunner.query(
        "DROP FUNCTION IF EXISTS sync_tender_mail_message_ids()",
      );
      if (hasCanonical) {
        await queryRunner.query(
          'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "providerMessageId"',
        );
      }
    }
  }
}
