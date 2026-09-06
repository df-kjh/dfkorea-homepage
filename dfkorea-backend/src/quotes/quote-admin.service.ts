import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { QuotePayloadUnavailableError } from "./quote-private-storage";
import { QuotePrivateStorage } from "./quote-attachment.service";
import { QuoteRetryDto } from "./quote.dto";

const deliveryStatuses = [
  "PENDING",
  "SENDING",
  "PROVIDER_ACCEPTED",
  "FAILED",
  "DELIVERY_UNCERTAIN",
] as const;
export interface QuoteAdminActor {
  userId?: string;
  username?: string;
}

@Injectable()
export class QuoteAdminService {
  constructor(
    private readonly db: DataSource,
    private readonly storage: QuotePrivateStorage,
  ) {}

  async list(query: Record<string, unknown>) {
    const integer = (
      value: unknown,
      fallback: number,
      field: string,
      maximum: number,
    ) => {
      if (value === undefined) return fallback;
      if (
        typeof value !== "string" ||
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 ||
        Number(value) > maximum
      ) {
        throw new BadRequestException(
          `${field} must be an integer from 1 to ${maximum}`,
        );
      }
      return Number(value);
    };
    const page = integer(query.page, 1, "page", 1000000);
    const limit = integer(query.limit, 25, "limit", 100);
    const status = query.status;
    if (
      status !== undefined &&
      (typeof status !== "string" ||
        !deliveryStatuses.includes(status as (typeof deliveryStatuses)[number]))
    ) {
      throw new BadRequestException(
        "status must be a supported quote mail delivery status",
      );
    }
    const filter = status ?? null;
    const [data, totals, summaries] = await Promise.all([
      this.db.query(
        `SELECT r.id, r.reference, r.company->>'companyName' AS "companyName",
        r.company->>'contactName' AS "contactName", r.created_at AS "createdAt",
        d.status, d.attempts, d.error_code AS "errorCode", d.next_attempt_at AS "nextAttemptAt"
        FROM quote_requests r JOIN quote_mail_deliveries d ON d.request_id=r.id
        WHERE ($1::text IS NULL OR d.status=$1) ORDER BY r.created_at DESC,r.id
        LIMIT $2 OFFSET $3`,
        [filter, limit, (page - 1) * limit],
      ),
      this.db.query(
        `SELECT count(*)::int AS total FROM quote_requests r
        JOIN quote_mail_deliveries d ON d.request_id=r.id WHERE ($1::text IS NULL OR d.status=$1)`,
        [filter],
      ),
      this.db.query(
        "SELECT status,count(*)::int AS count,min(created_at) AS oldest FROM quote_mail_deliveries GROUP BY status",
      ),
    ]);
    const counts = Object.fromEntries(
      deliveryStatuses.map((value) => [value, 0]),
    );
    let oldestPendingAt: Date | null = null;
    for (const summary of summaries) {
      counts[summary.status] = summary.count;
      if (summary.status === "PENDING") oldestPendingAt = summary.oldest;
    }
    const total: number = totals[0].total;
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts,
      oldestPendingAt,
    };
  }

  async detail(id: string) {
    const [receipt] = await this.db.query(
      `SELECT id,reference,company,verified_at AS "verifiedAt",
      consent_version AS "consentVersion",consented_at AS "consentedAt",notes,
      requested_delivery_date AS "requestedDeliveryDate",created_at AS "createdAt",expires_at AS "expiresAt"
      FROM quote_requests WHERE id=$1`,
      [id],
    );
    if (!receipt) throw new NotFoundException("견적 접수를 찾을 수 없습니다.");
    const [items, attachments, deliveries] = await Promise.all([
      this.db.query(
        `SELECT id,client_id AS "clientId",kind,product_id AS "productId",snapshot,selected,quantity
        FROM quote_items WHERE request_id=$1 ORDER BY created_at,id`,
        [id],
      ),
      this.db.query(
        `SELECT a.id,a.item_id AS "itemId",a.name,a.mime_type AS "mimeType",a.size,a.state,
        EXISTS(SELECT 1 FROM quote_attachment_payloads p WHERE p.attachment_id=a.id AND p.expires_at>now()) AS available,
        (SELECT p.expires_at FROM quote_attachment_payloads p WHERE p.attachment_id=a.id) AS "payloadExpiresAt"
        FROM quote_attachments a WHERE a.request_id=$1 ORDER BY a.created_at,a.id`,
        [id],
      ),
      this.db.query(
        `SELECT id,status,attempts,claimed_at AS "claimedAt",next_attempt_at AS "nextAttemptAt",
        error_code AS "errorCode",provider_accepted_at AS "providerAcceptedAt",history,created_at AS "createdAt"
        FROM quote_mail_deliveries WHERE request_id=$1`,
        [id],
      ),
    ]);
    return {
      request: receipt,
      items,
      attachments,
      delivery: deliveries[0] ?? null,
    };
  }

  async attachment(requestId: string, attachmentId: string) {
    const [photo] = await this.db.query(
      `SELECT a.storage_key,a.name,a.mime_type FROM quote_attachments a
      JOIN quote_requests r ON r.id=a.request_id
      WHERE a.id=$1 AND a.request_id=$2 AND a.state='READY'`,
      [attachmentId, requestId],
    );
    if (!photo)
      throw new NotFoundException("견적에 연결된 사진을 찾을 수 없습니다.");
    if (!["image/jpeg", "image/png"].includes(photo.mime_type))
      throw new ServiceUnavailableException("사진 형식을 확인할 수 없습니다.");
    try {
      return {
        bytes: await this.storage.read(photo.storage_key),
        name: photo.name,
        mimeType: photo.mime_type,
      };
    } catch (error) {
      if (error instanceof QuotePayloadUnavailableError)
        throw new GoneException(
          "사진은 메일 발송 수락 또는 임시 보관기간 만료 후 서버에서 삭제됩니다. 수신 메일 첨부를 확인해 주세요.",
        );
      // 저장 키와 저장소 오류 상세가 HTTP 응답으로 노출되지 않도록 안전한 오류로 변환한다.
      throw new ServiceUnavailableException(
        "사진을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  }

  async retry(id: string, body: QuoteRetryDto, actor: QuoteAdminActor) {
    if (!actor || (!actor.userId && !actor.username))
      throw new UnauthorizedException();
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (
      body?.acknowledgeDuplicateRisk !== true ||
      reason.length < 5 ||
      reason.length > 500
    ) {
      throw new BadRequestException(
        "중복 발송 가능성에 동의하고 5~500자의 재전송 사유를 입력해 주세요.",
      );
    }
    return this.db.transaction(async (manager) => {
      // 상태 확인과 재전송 대기 전환을 같은 행 잠금 안에서 처리해 동시 클릭과 작업자 점유를 직렬화한다.
      const [delivery] = await manager.query(
        `SELECT d.id,d.status,r.expires_at FROM quote_mail_deliveries d
        JOIN quote_requests r ON r.id=d.request_id WHERE r.id=$1 FOR UPDATE OF d`,
        [id],
      );
      if (!delivery)
        throw new NotFoundException("견적 발송 기록을 찾을 수 없습니다.");
      if (new Date(delivery.expires_at).getTime() <= Date.now())
        throw new GoneException(
          "보유기간이 만료된 견적은 재전송할 수 없습니다.",
        );
      if (!["FAILED", "DELIVERY_UNCERTAIN"].includes(delivery.status)) {
        throw new ConflictException(
          "실패하거나 수락 여부가 불명확한 메일만 수동 재전송할 수 있습니다.",
        );
      }
      const photos = await manager.query(
        "SELECT id FROM quote_attachments WHERE request_id=$1",
        [id],
      );
      try {
        await this.storage.assertAvailable(
          photos.map((photo) => photo.id),
          manager,
        );
      } catch (error) {
        if (error instanceof QuotePayloadUnavailableError)
          throw new GoneException(
            "사진의 임시 보관기간이 만료되어 재전송할 수 없습니다.",
          );
        throw error;
      }
      const audit = {
        event: "MANUAL_RETRY",
        previousStatus: delivery.status,
        actor,
        reason,
        at: new Date().toISOString(),
      };
      // 이전 error_code·수락 시각·이력을 보존하여 운영자가 원래 장애와 중복 가능성을 확인할 수 있게 한다.
      await manager.query(
        `UPDATE quote_mail_deliveries SET status='PENDING',attempts=0,next_attempt_at=now(),
        claimed_at=NULL,claim_token=NULL,history=history || $2::jsonb WHERE id=$1`,
        [delivery.id, JSON.stringify([audit])],
      );
      return { id, status: "PENDING" as const };
    });
  }
}
