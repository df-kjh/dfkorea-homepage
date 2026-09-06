import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenderAnalysisTables1788699000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "tender_company_profiles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "singletonKey" varchar(32) NOT NULL DEFAULT 'company',
        "companyName" varchar NOT NULL,
        "businessNumber" varchar(10) NOT NULL,
        "headquartersSido" varchar NOT NULL,
        "headquartersSigungu" varchar NOT NULL,
        "g2bRegistered" boolean NOT NULL DEFAULT false,
        "supplyProducts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "licenses" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "companyTypes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "directProduction" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "certifications" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "performanceRecords" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_company_profile_singleton_key" UNIQUE ("singletonKey")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tender_award_results" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar NOT NULL,
        "sourceNoticeId" varchar NOT NULL,
        "revision" varchar NOT NULL,
        "productClassification" varchar NOT NULL,
        "productGroup" varchar,
        "awardMethod" varchar,
        "region" varchar,
        "openedAt" timestamptz NOT NULL,
        "basisAmount" numeric(20, 2),
        "expectedPrice" numeric(20, 2),
        "winningAmount" numeric(20, 2),
        "adjustmentRate" numeric(10, 6),
        "winningRate" numeric(10, 6),
        "isFinalAward" boolean NOT NULL DEFAULT false,
        "isFailedBid" boolean NOT NULL DEFAULT false,
        "collectedAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_award_result_identity" UNIQUE ("source", "sourceNoticeId", "revision", "productClassification", "openedAt")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_award_result_opened_at" ON "tender_award_results" ("openedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_award_result_classification_method_region" ON "tender_award_results" ("productClassification", "awardMethod", "region")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tender_award_sync_runs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar NOT NULL,
        "periodStart" date NOT NULL,
        "periodEnd" date NOT NULL,
        "cursor" varchar,
        "status" varchar NOT NULL DEFAULT 'RUNNING',
        "fetchedCount" integer NOT NULL DEFAULT 0,
        "storedCount" integer NOT NULL DEFAULT 0,
        "excludedCount" integer NOT NULL DEFAULT 0,
        "leaseToken" uuid,
        "leaseExpiresAt" timestamptz,
        "errorCode" varchar,
        "finishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_award_sync_run_source_period" UNIQUE ("source", "periodStart", "periodEnd")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_award_sync_run_status_lease" ON "tender_award_sync_runs" ("status", "leaseExpiresAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tender_analyses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenderId" uuid NOT NULL,
        "tenderFingerprint" varchar(64) NOT NULL,
        "documentFingerprint" varchar(64),
        "companyProfileFingerprint" varchar(64),
        "productCatalogFingerprint" varchar(64),
        "analyzerVersion" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "suitability" varchar,
        "specificationScore" numeric(5, 2),
        "comparableRequirementCount" integer NOT NULL DEFAULT 0,
        "satisfiedRequirementCount" integer NOT NULL DEFAULT 0,
        "unsatisfiedRequirementCount" integer NOT NULL DEFAULT 0,
        "unknownRequirementCount" integer NOT NULL DEFAULT 0,
        "requirements" jsonb,
        "certificationAnalysis" jsonb,
        "participationAnalysis" jsonb,
        "priceAnalysis" jsonb,
        "evidence" jsonb,
        "processingToken" uuid,
        "leaseExpiresAt" timestamptz,
        "errorCode" varchar,
        "analyzedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_analysis_tender" UNIQUE ("tenderId"),
        CONSTRAINT "FK_tender_analysis_tender" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_analysis_status_lease" ON "tender_analyses" ("status", "leaseExpiresAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tender_documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenderId" uuid NOT NULL,
        "sourceDocumentIdentity" varchar NOT NULL,
        "displayName" varchar NOT NULL,
        "sourceUrl" varchar NOT NULL,
        "mimeType" varchar,
        "format" varchar,
        "contentHash" varchar(64),
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "errorCode" varchar,
        "textBlocks" jsonb,
        "tableBlocks" jsonb,
        "extractionMetadata" jsonb,
        "extractedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tender_document_tender_identity" UNIQUE ("tenderId", "sourceDocumentIdentity"),
        CONSTRAINT "FK_tender_document_tender" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tender_document_tender_status" ON "tender_documents" ("tenderId", "status")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tender_analysis_reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenderId" uuid NOT NULL,
        "analysisId" uuid,
        "analysisFingerprint" varchar(64) NOT NULL,
        "completed" boolean NOT NULL DEFAULT false,
        "note" varchar(2000),
        "reviewerAdminId" uuid,
        "reviewedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tender_analysis_review_tender" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tender_analysis_review_analysis" FOREIGN KEY ("analysisId") REFERENCES "tender_analyses"("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_analysis_reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_analyses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_award_sync_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_award_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tender_company_profiles"`);
  }
}
