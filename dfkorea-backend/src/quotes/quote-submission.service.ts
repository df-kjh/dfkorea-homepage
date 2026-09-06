import { QUOTE_PHOTO_RETENTION_DAYS } from "./quote-private-storage";
import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { randomBytes } from "crypto";
import { Product } from "../entities/product.entity";
import { QuoteSubmissionDto } from "./quote.dto";
import { QuoteSessionService } from "./quote-session.service";
import {
  assertAttachmentOwnership,
  assertVerification,
  idempotentReference,
  quoteError,
  submissionHash,
  tokenHash,
} from "./quote-policy";

@Injectable()
export class QuoteSubmissionService {
  constructor(
    private readonly db: DataSource,
    private readonly sessions: QuoteSessionService,
  ) {}
  async submit(sessionId: string, input: QuoteSubmissionDto) {
    const hash = submissionHash(input);
    return this.db.transaction(async (manager) => {
      const session = await this.sessions.lock(manager, sessionId);
      // 응답 유실 재시도는 만료된 검증/이미 연결된 사진보다 먼저 동일 접수를 복원한다.
      const [existing] = await manager.query(
        "SELECT reference,payload_hash FROM quote_requests WHERE session_id=$1 AND idempotency_key=$2",
        [sessionId, input.idempotencyKey],
      );
      if (existing)
        return {
          reference: idempotentReference(existing, hash),
          status: "RECEIVED" as const,
        };
      this.sessions.assertConsent(input.consentVersion);
      if (session.submit_count >= 5)
        quoteError(
          429,
          "SUBMISSION_LIMIT",
          "접수 횟수를 초과했습니다. 전화 또는 이메일로 문의해 주세요.",
        );
      const [verification] = await manager.query(
        "SELECT * FROM quote_business_verifications WHERE token_hash=$1",
        [tokenHash(input.verificationToken)],
      );
      assertVerification(verification, sessionId, input.company);
      if (verification.consent_version !== input.consentVersion)
        quoteError(
          422,
          "CONSENT_REQUIRED",
          "현재 안내에 동의 후 사업자 정보를 다시 확인해 주세요.",
        );
      if (
        new Set(input.items.map((item) => item.clientId)).size !==
        input.items.length
      )
        quoteError(400, "DUPLICATE_ITEM", "품목 식별자가 중복되었습니다.");
      const allAttachmentIds = input.items.flatMap(
        (item) => item.attachmentIds,
      );
      if (
        allAttachmentIds.length > 3 ||
        new Set(allAttachmentIds).size !== allAttachmentIds.length
      )
        quoteError(
          400,
          "ATTACHMENT_LIMIT",
          "사진은 요청 전체 3장까지이며 각 사진은 한 품목에만 연결할 수 있습니다.",
        );
      const attachments = allAttachmentIds.length
        ? await manager.query(
            "SELECT * FROM quote_attachments WHERE id=ANY($1::uuid[]) FOR UPDATE",
            [allAttachmentIds],
          )
        : [];
      if (attachments.length !== allAttachmentIds.length)
        quoteError(
          422,
          "INVALID_ATTACHMENT",
          "첨부 사진을 다시 선택해 주세요.",
        );
      for (const attachment of attachments)
        assertAttachmentOwnership(attachment, sessionId);
      if (allAttachmentIds.length) {
        const payloads = await manager.query(
          "SELECT attachment_id FROM quote_attachment_payloads WHERE attachment_id=ANY($1::uuid[]) AND expires_at>now() FOR SHARE",
          [allAttachmentIds],
        );
        if (payloads.length !== allAttachmentIds.length)
          quoteError(
            410,
            "ATTACHMENT_PAYLOAD_UNAVAILABLE",
            "사진의 임시 보관기간이 끝났습니다. 사진을 다시 선택해 주세요.",
          );
      }
      if (
        attachments.reduce((total, item) => total + item.size, 0) >
        6 * 1024 * 1024
      )
        quoteError(
          400,
          "ATTACHMENT_LIMIT",
          "사진 전체 용량은 6MB 이하여야 합니다.",
        );
      const snapshots = [];
      for (const item of input.items) {
        if (item.kind === "catalog") {
          if (!item.productId || item.attachmentIds.length)
            quoteError(
              400,
              "INVALID_CATALOG_ITEM",
              "카탈로그 제품과 첨부 정보를 확인해 주세요.",
            );
          const product = await manager.getRepository(Product).findOne({
            where: { id: item.productId },
            lock: { mode: "pessimistic_read" },
          });
          if (!product)
            quoteError(
              422,
              "PRODUCT_UNAVAILABLE",
              "제품 정보를 찾을 수 없습니다. 제품을 다시 선택해 주세요.",
            );
          if (
            (item.power !== undefined &&
              !product.power.map(Number).includes(item.power)) ||
            (item.colorTemp !== undefined &&
              !product.colorTemp.map(Number).includes(item.colorTemp)) ||
            item.options.some((value) => !product.options.includes(value))
          )
            quoteError(
              422,
              "SPECIFICATION_UNAVAILABLE",
              "제품의 현재 선택 사양을 다시 확인해 주세요.",
            );
          snapshots.push({
            name: product.name,
            modelName: product.modelName,
            category: product.category,
            dimensions: product.dimensions,
            power: product.power,
            colorTemp: product.colorTemp,
            certifications: product.certifications,
            options: product.options,
          });
        } else {
          if (item.productId || !item.name?.trim() || !item.description?.trim())
            quoteError(
              400,
              "CUSTOM_DETAILS_REQUIRED",
              "직접 입력 품목 이름과 요구 사양을 작성해 주세요.",
            );
          snapshots.push({
            name: item.name,
            description: item.description,
            dimensions: item.dimensions || "",
          });
        }
      }
      const reference = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(8).toString("hex").toUpperCase()}`;
      const [request] = await manager.query(
        "INSERT INTO quote_requests(session_id,reference,idempotency_key,payload_hash,company,verified_at,consent_version,consented_at,notes,requested_delivery_date,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,now()+$10*interval '1 day') RETURNING id,expires_at",
        [
          sessionId,
          reference,
          input.idempotencyKey,
          hash,
          JSON.stringify(input.company),
          verification.verified_at,
          input.consentVersion,
          input.notes || null,
          input.requestedDeliveryDate || null,
          this.sessions.privacy().retentionDays,
        ],
      );
      for (const [index, item] of input.items.entries()) {
        const [saved] = await manager.query(
          "INSERT INTO quote_items(request_id,client_id,kind,product_id,snapshot,selected,quantity) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            request.id,
            item.clientId,
            item.kind,
            item.productId || null,
            JSON.stringify(snapshots[index]),
            JSON.stringify({
              power: item.power ?? null,
              colorTemp: item.colorTemp ?? null,
              options: item.options,
              certifications: item.certifications,
              description:
                item.kind === "catalog" ? item.description || "" : undefined,
            }),
            item.quantity,
          ],
        );
        if (item.attachmentIds.length) {
          await manager.query(
            "UPDATE quote_attachments SET request_id=$1,item_id=$2,expires_at=$3 WHERE id=ANY($4::uuid[])",
            [request.id, saved.id, request.expires_at, item.attachmentIds],
          );
          await manager.query(
            "UPDATE quote_attachment_payloads SET expires_at=LEAST($2::timestamptz,now()+$3*interval '1 day') WHERE attachment_id=ANY($1::uuid[])",
            [
              item.attachmentIds,
              request.expires_at,
              QUOTE_PHOTO_RETENTION_DAYS,
            ],
          );
        }
      }
      await manager.query(
        "INSERT INTO quote_mail_deliveries(request_id,status) VALUES($1,'PENDING')",
        [request.id],
      );
      await manager.query(
        "UPDATE quote_sessions SET submit_count=submit_count+1 WHERE id=$1",
        [sessionId],
      );
      return { reference, status: "RECEIVED" as const };
    });
  }
}
