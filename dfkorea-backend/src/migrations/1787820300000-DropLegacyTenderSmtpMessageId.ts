import { MigrationInterface, QueryRunner } from "typeorm";

export class DropLegacyTenderSmtpMessageId1787820300000
  implements MigrationInterface
{
  name = "DropLegacyTenderSmtpMessageId1787820300000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tender_mail_deliveries"))) return;

    const hasLegacy = await queryRunner.hasColumn(
      "tender_mail_deliveries",
      "smtpMessageId",
    );
    const hasCanonical = await queryRunner.hasColumn(
      "tender_mail_deliveries",
      "providerMessageId",
    );
    if (!hasCanonical) {
      await queryRunner.query(
        'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "providerMessageId" varchar',
      );
    }
    if (hasLegacy) {
      await queryRunner.query(
        'UPDATE "tender_mail_deliveries" SET "providerMessageId" = COALESCE("providerMessageId", "smtpMessageId") WHERE "providerMessageId" IS NULL',
      );
    }
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TR_sync_tender_mail_message_ids" ON "tender_mail_deliveries"',
    );
    await queryRunner.query(
      "DROP FUNCTION IF EXISTS sync_tender_mail_message_ids()",
    );
    if (hasLegacy) {
      await queryRunner.query(
        'ALTER TABLE "tender_mail_deliveries" DROP COLUMN "smtpMessageId"',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tender_mail_deliveries"))) return;

    const hasLegacy = await queryRunner.hasColumn(
      "tender_mail_deliveries",
      "smtpMessageId",
    );
    if (!hasLegacy) {
      await queryRunner.query(
        'ALTER TABLE "tender_mail_deliveries" ADD COLUMN "smtpMessageId" varchar',
      );
    }
    await queryRunner.query(
      'UPDATE "tender_mail_deliveries" SET "smtpMessageId" = COALESCE("smtpMessageId", "providerMessageId") WHERE "smtpMessageId" IS NULL',
    );
    // Recreate bidirectional synchronization so a rolled-back old container
    // and a still-draining new container can safely overlap.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_tender_mail_message_ids() RETURNS trigger AS $$
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
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS "TR_sync_tender_mail_message_ids" ON "tender_mail_deliveries"',
    );
    await queryRunner.query(
      'CREATE TRIGGER "TR_sync_tender_mail_message_ids" BEFORE INSERT OR UPDATE ON "tender_mail_deliveries" FOR EACH ROW EXECUTE FUNCTION sync_tender_mail_message_ids()',
    );
  }
}
