import { getMetadataArgsStorage } from "typeorm";
import { Tender } from "./tender.entity";
import { TenderMailItem } from "./tender-mail-item.entity";
import { TenderMailDelivery } from "./tender-mail-delivery.entity";
import { TenderRecipient } from "./tender-recipient.entity";
import { TenderDailyDispatch } from "./tender-daily-dispatch.entity";
import { TenderMailOAuthCredential } from "./tender-mail-oauth-credential.entity";
import { TenderCompanyProfile } from "./tender-company-profile.entity";
import { TenderDocument } from "./tender-document.entity";
import { TenderAnalysis } from "./tender-analysis.entity";
import { TenderAnalysisReview } from "./tender-analysis-review.entity";
import { TenderAwardResult } from "./tender-award-result.entity";
import { TenderAwardSyncRun } from "./tender-award-sync-run.entity";

describe("tender entity metadata", () => {
  it("deduplicates source notice revisions", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === Tender &&
        item.name === "UQ_tender_source_notice_revision",
    );

    expect(unique?.columns).toEqual(["source", "sourceNoticeId", "revision"]);
  });

  it("tracks one delivery state per recipient and tender", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderMailItem &&
        item.name === "UQ_tender_mail_item_recipient_tender",
    );

    expect(unique?.columns).toEqual(["recipientId", "tenderId"]);
  });

  it("indexes the durable delivery lease for stale-claim recovery", () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === TenderMailDelivery &&
        item.name === "IDX_tender_mail_delivery_status_claimed_at",
    );

    expect(index?.columns).toEqual(["status", "claimedAt"]);
  });

  it("keeps one durable recipient outcome per daily dispatch", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderMailDelivery &&
        item.name === "UQ_tender_mail_delivery_dispatch_recipient",
    );

    expect(unique?.columns).toEqual(["dailyDispatchId", "recipientId"]);
  });

  it("indexes the daily dispatch lease for stale-claim recovery", () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === TenderDailyDispatch &&
        item.name === "IDX_tender_daily_dispatch_status_lease",
    );

    expect(index?.columns).toEqual(["status", "leaseExpiresAt"]);
  });

  it("indexes active recipients within the shared subscription", () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === TenderRecipient &&
        item.name === "IDX_tender_recipient_subscription_active",
    );

    expect(index?.columns).toEqual(["subscriptionId", "isActive"]);
  });

  it("uses the KST date and configured time as the dispatch identity", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderDailyDispatch &&
        item.name === "UQ_tender_daily_dispatch_business_date_delivery_time",
    );

    expect(unique?.columns).toEqual(["businessDate", "deliveryTime"]);
  });

  it("stores only one NAVER WORKS OAuth credential set", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderMailOAuthCredential &&
        item.name === "UQ_tender_mail_oauth_credential_singleton_key",
    );

    expect(unique?.columns).toEqual(["singletonKey"]);
  });

  it("keeps one company bid profile", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderCompanyProfile &&
        item.name === "UQ_tender_company_profile_singleton_key",
    );

    expect(unique?.columns).toEqual(["singletonKey"]);
  });

  it("keeps each source document unique within its tender", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderDocument &&
        item.name === "UQ_tender_document_tender_identity",
    );

    expect(unique?.columns).toEqual(["tenderId", "sourceDocumentIdentity"]);
  });

  it("keeps one current suitability analysis per tender", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderAnalysis &&
        item.name === "UQ_tender_analysis_tender",
    );

    expect(unique?.columns).toEqual(["tenderId"]);
  });

  it("indexes analysis and award worker leases for recovery", () => {
    const analysisIndex = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === TenderAnalysis &&
        item.name === "IDX_tender_analysis_status_lease",
    );
    const syncIndex = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === TenderAwardSyncRun &&
        item.name === "IDX_tender_award_sync_run_status_lease",
    );

    expect(analysisIndex?.columns).toEqual(["status", "leaseExpiresAt"]);
    expect(syncIndex?.columns).toEqual(["status", "leaseExpiresAt"]);
  });

  it("keeps normalized award-result identities and review references", () => {
    const awardUnique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderAwardResult &&
        item.name === "UQ_tender_award_result_identity",
    );
    const reviewColumns = getMetadataArgsStorage().columns.filter(
      (item) => item.target === TenderAnalysisReview,
    );

    expect(awardUnique?.columns).toEqual([
      "source",
      "sourceNoticeId",
      "revision",
      "productClassification",
      "openedAt",
    ]);
    expect(reviewColumns.map((item) => item.propertyName)).toEqual(
      expect.arrayContaining(["tenderId", "analysisId", "analysisFingerprint"]),
    );
  });
});

it("stores the authenticated integer Admin identity in reviews", () => {
  const column = getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === TenderAnalysisReview &&
      column.propertyName === "reviewerAdminId",
  );
  expect(column.options.type).toBe("integer");
});
