import { getMetadataArgsStorage } from "typeorm";
import { Tender } from "./tender.entity";
import { TenderMailItem } from "./tender-mail-item.entity";
import { TenderMailDelivery } from "./tender-mail-delivery.entity";
import { TenderRecipient } from "./tender-recipient.entity";
import { TenderDailyDispatch } from "./tender-daily-dispatch.entity";
import { TenderMailOAuthCredential } from "./tender-mail-oauth-credential.entity";

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

  it("keeps one daily dispatch identity per KST business date", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderDailyDispatch &&
        item.name === "UQ_tender_daily_dispatch_business_date",
    );

    expect(unique?.columns).toEqual(["businessDate"]);
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

  it("stores only one NAVER WORKS OAuth credential set", () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderMailOAuthCredential &&
        item.name === "UQ_tender_mail_oauth_credential_singleton_key",
    );

    expect(unique?.columns).toEqual(["singletonKey"]);
  });
});
