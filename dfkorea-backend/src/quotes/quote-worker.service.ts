import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { NaverWorksOAuthService } from "../tenders/mail/naver-works-oauth.service";
import { NaverWorksMailTransport } from "../tenders/mail/naver-works-mail.transport";
import {
  MailDeliveryError,
  MailDeliveryOutcome,
} from "../tenders/mail/mail-delivery-outcome";
import { QuotePayloadUnavailableError } from "./quote-private-storage";
import { QuotePrivateStorage } from "./quote-attachment.service";
import { deliveryFailure, tokenHash } from "./quote-policy";
import { renderQuoteMail } from "./quote-mail";
import { quoteWorkerEnabled } from "./quote-configuration";

@Injectable()
export class QuoteWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuoteWorkerService.name);
  private timer: NodeJS.Timeout;
  private busy = false;
  private readonly transport: NaverWorksMailTransport;
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    oauth: NaverWorksOAuthService,
    private readonly storage: QuotePrivateStorage,
  ) {
    this.transport = new NaverWorksMailTransport(config, oauth);
  }
  onModuleInit() {
    if (!quoteWorkerEnabled(this.config)) return;
    this.timer = setInterval(() => void this.tick(), 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.recover();
      await this.processOne();
      await this.cleanup();
    } catch {
      this.logger.error("QUOTE_WORKER_CYCLE_FAILED");
    } finally {
      this.busy = false;
    }
  }
  async recover() {
    // 제공자 idempotency 지원이 없으므로 작업자 중단 뒤에는 자동 재발송하지 않는다.
    await this.db.query(
      "UPDATE quote_mail_deliveries SET status='DELIVERY_UNCERTAIN',error_code='WORKER_INTERRUPTED',claim_token=NULL,history=history || jsonb_build_array(jsonb_build_object('at',now(),'event','WORKER_INTERRUPTED')) WHERE status='SENDING' AND claimed_at<now()-interval '5 minutes'",
    );
  }
  async processOne() {
    const claimToken = randomUUID();
    const delivery = await this.db.transaction(async (manager) => {
      const [row] = await manager.query(
        "SELECT d.* FROM quote_mail_deliveries d JOIN quote_requests r ON r.id=d.request_id WHERE d.status='PENDING' AND d.next_attempt_at<=now() AND r.expires_at>now() ORDER BY d.next_attempt_at,d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED",
      );
      if (!row) return null;
      await manager.query(
        "UPDATE quote_mail_deliveries SET status='SENDING',attempts=attempts+1,claimed_at=now(),claim_token=$2 WHERE id=$1",
        [row.id, claimToken],
      );
      return { ...row, attempts: row.attempts + 1 };
    });
    if (!delivery) return false;
    let providerCalled = false;
    try {
      const [request] = await this.db.query(
        "SELECT * FROM quote_requests WHERE id=$1",
        [delivery.request_id],
      );
      const items = await this.db.query(
        "SELECT * FROM quote_items WHERE request_id=$1 ORDER BY created_at,id",
        [request.id],
      );
      const photos = await this.db.query(
        "SELECT * FROM quote_attachments WHERE request_id=$1 ORDER BY created_at,id",
        [request.id],
      );
      const attachments = [];
      for (const photo of photos) {
        const bytes = await this.storage.read(photo.storage_key);
        if (
          bytes.length !== photo.size ||
          tokenHash(bytes.toString("base64")) !== photo.sha256
        )
          throw new QuotePayloadUnavailableError();
        attachments.push({
          filename: photo.name,
          fileType: photo.mime_type,
          data: bytes.toString("base64"),
        });
      }
      providerCalled = true;
      await this.transport.sendMail({
        ...renderQuoteMail(request, items, photos),
        attachments,
      });
      await this.db.transaction(async (manager) => {
        // 현재 점유한 작업자만 202 수락과 bytes 삭제를 함께 확정한다. 오래된 작업자는 새 시도의 사진을 지우지 못한다.
        const [current] = await manager.query(
          "SELECT status,claim_token FROM quote_mail_deliveries WHERE id=$1 FOR UPDATE",
          [delivery.id],
        );
        if (
          !current ||
          current.status !== "SENDING" ||
          current.claim_token !== claimToken
        )
          return;
        await manager.query(
          "UPDATE quote_mail_deliveries SET status='PROVIDER_ACCEPTED',provider_accepted_at=now(),error_code=NULL,claim_token=NULL,history=history || jsonb_build_array(jsonb_build_object('at',now(),'event','PROVIDER_ACCEPTED','attempt',attempts)) WHERE id=$1",
          [delivery.id],
        );
        await manager.query(
          "DELETE FROM quote_attachment_payloads p USING quote_attachments a WHERE p.attachment_id=a.id AND a.request_id=$1",
          [delivery.request_id],
        );
      });
    } catch (error) {
      // 파일/DB 읽기 실패는 아직 메일 호출 전이므로 명백한 재시도 가능 실패다.
      const failure =
        error instanceof QuotePayloadUnavailableError
          ? {
              status: "FAILED",
              errorCode: "ATTACHMENT_PAYLOAD_UNAVAILABLE",
              delayMinutes: null,
            }
          : deliveryFailure(
              !providerCalled && !(error instanceof MailDeliveryError)
                ? new MailDeliveryError(MailDeliveryOutcome.RETRYABLE_REJECTION)
                : error,
              delivery.attempts,
            );
      await this.db.query(
        "UPDATE quote_mail_deliveries SET status=$3,error_code=$4,next_attempt_at=now()+$5*interval '1 minute',claim_token=NULL,history=history || jsonb_build_array(jsonb_build_object('at',now(),'event',$4::text,'attempt',attempts)) WHERE id=$1 AND status='SENDING' AND claim_token=$2",
        [
          delivery.id,
          claimToken,
          failure.status,
          failure.errorCode,
          failure.delayMinutes || 0,
        ],
      );
    }
    return true;
  }
  async cleanup() {
    // 발송/재전송/수락확정과 동일하게 delivery 행을 먼저 잠근다. 발송중 bytes는 만료되어도 중간 삭제하지 않는다.
    for (let index = 0; index < 20; index++) {
      const removed = await this.db.transaction(async (manager) => {
        const [delivery] = await manager.query(
          "SELECT d.id,d.request_id FROM quote_mail_deliveries d WHERE d.status!='SENDING' AND EXISTS(SELECT 1 FROM quote_attachments a JOIN quote_attachment_payloads p ON p.attachment_id=a.id WHERE a.request_id=d.request_id AND p.expires_at<=now()) ORDER BY d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED",
        );
        if (!delivery) return false;
        // 메타데이터는 요청 보유기간까지 남겨 사진 없는 불완전한 메일 발송을 방지한다.
        await manager.query(
          "DELETE FROM quote_attachment_payloads p USING quote_attachments a WHERE p.attachment_id=a.id AND a.request_id=$1 AND p.expires_at<=now()",
          [delivery.request_id],
        );
        return true;
      });
      if (!removed) break;
    }
    for (let index = 0; index < 20; index++) {
      const removed = await this.db.transaction(async (manager) => {
        const [photo] = await manager.query(
          "SELECT id FROM quote_attachments WHERE request_id IS NULL AND (expires_at<=now() OR state='DELETING') ORDER BY expires_at LIMIT 1 FOR UPDATE SKIP LOCKED",
        );
        if (!photo) return false;
        await manager.query("DELETE FROM quote_attachments WHERE id=$1", [
          photo.id,
        ]);
        return true;
      });
      if (!removed) break;
    }
    for (let index = 0; index < 20; index++) {
      const removed = await this.db.transaction(async (manager) => {
        const [delivery] = await manager.query(
          "SELECT d.id,d.request_id FROM quote_mail_deliveries d JOIN quote_requests r ON r.id=d.request_id WHERE r.expires_at<=now() AND d.status!='SENDING' ORDER BY r.expires_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED",
        );
        if (!delivery) return false;
        await manager.query(
          "DELETE FROM quote_attachments WHERE request_id=$1",
          [delivery.request_id],
        );
        await manager.query("DELETE FROM quote_requests WHERE id=$1", [
          delivery.request_id,
        ]);
        return true;
      });
      if (!removed) break;
    }
    await this.db.query(
      "DELETE FROM quote_business_verifications WHERE expires_at<now()",
    );
    await this.db.query(
      "DELETE FROM quote_sessions s WHERE expires_at<now() AND NOT EXISTS(SELECT 1 FROM quote_attachments a WHERE a.session_id=s.id) AND NOT EXISTS(SELECT 1 FROM quote_requests r WHERE r.session_id=s.id)",
    );
    await this.db.query(
      "DELETE FROM quote_ip_quotas WHERE window_start<now()-interval '24 hours'",
    );
  }
}
