import { Injectable, HttpException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { extname } from "path";
import sharp = require("sharp");
import {
  assertAttachmentOwnership,
  quoteError,
  tokenHash,
} from "./quote-policy";
import { QuoteSessionService } from "./quote-session.service";
import {
  QuotePrivateStorage,
  QuotePayloadUnavailableError,
} from "./quote-private-storage";
export { QuotePrivateStorage } from "./quote-private-storage";

type ImageInput = Pick<
  Express.Multer.File,
  "buffer" | "originalname" | "mimetype"
>;
export async function prepareQuoteImage(file: ImageInput) {
  if (
    !file?.buffer ||
    file.buffer.length > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
  )
    quoteError(
      400,
      "INVALID_IMAGE",
      "JPEG·PNG·WebP 사진을 5MB 이하로 선택해 주세요.",
    );
  const extension = extname(file.originalname).toLowerCase();
  const formats = {
    jpeg: { mime: "image/jpeg", extensions: [".jpg", ".jpeg"] },
    png: { mime: "image/png", extensions: [".png"] },
    webp: { mime: "image/webp", extensions: [".webp"] },
  };
  try {
    const metadata = await sharp(file.buffer, {
      limitInputPixels: 40000000,
      failOn: "warning",
      animated: true,
    }).metadata();
    const format = formats[metadata.format];
    if (
      !format ||
      file.mimetype !== format.mime ||
      !format.extensions.includes(extension) ||
      (metadata.pages || 1) > 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > 40000000
    )
      throw new Error("invalid-image");
    for (const quality of [85, 70, 55]) {
      const buffer = await sharp(file.buffer, {
        limitInputPixels: 40000000,
        failOn: "warning",
      })
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (buffer.length <= 2 * 1024 * 1024)
        return { buffer, mimeType: "image/jpeg", extension: ".jpg" };
    }
  } catch {
    quoteError(
      400,
      "INVALID_IMAGE",
      "사진 형식·손상 여부·픽셀 수(최대 40MP)를 확인해 주세요.",
    );
  }
  quoteError(
    400,
    "IMAGE_TOO_LARGE",
    "사진을 메일 첨부 크기로 줄일 수 없습니다. 다른 사진을 선택해 주세요.",
  );
}
@Injectable()
export class QuoteAttachmentService {
  constructor(
    private readonly db: DataSource,
    private readonly sessions: QuoteSessionService,
    private readonly storage: QuotePrivateStorage,
  ) {}
  async upload(
    sessionId: string,
    file: ImageInput,
    clientAttachmentId: string,
  ) {
    if (
      !file?.buffer ||
      file.buffer.length === 0 ||
      file.buffer.length > 5 * 1024 * 1024
    )
      quoteError(400, "INVALID_IMAGE", "사진을 5MB 이하로 선택해 주세요.");
    const sourceHash = tokenHash(file.buffer.toString("base64"));
    const claimToken = randomUUID();
    // 세션/클라이언트 사진 UUID로 예약을 재사용하여 응답 유실과 동시 재시도가 슬롯을 중복 차감하지 않는다.
    const reservation = await this.db.transaction(async (manager) => {
      const session = await this.sessions.lock(manager, sessionId);
      const [existing] = await manager.query(
        "SELECT * FROM quote_attachments WHERE session_id=$1 AND client_attachment_id=$2 FOR UPDATE",
        [sessionId, clientAttachmentId],
      );
      if (existing) {
        if (
          existing.source_hash !== sourceHash ||
          existing.source_size !== file.buffer.length
        )
          quoteError(
            409,
            "ATTACHMENT_CONTENT_CONFLICT",
            "같은 사진 식별자로 다른 파일을 보낼 수 없습니다. 사진을 다시 선택해 주세요.",
          );
        if (existing.request_id)
          quoteError(
            409,
            "ATTACHMENT_ALREADY_SUBMITTED",
            "이미 접수된 사진입니다. 새 사진으로 선택해 주세요.",
          );
        if (
          existing.state === "DELETING" ||
          new Date(existing.expires_at) <= new Date()
        )
          quoteError(
            410,
            "ATTACHMENT_EXPIRED",
            "사진이 삭제되었거나 만료되었습니다. 다시 선택해 주세요.",
          );
        if (existing.state === "READY") {
          try {
            await this.storage.assertAvailable([existing.id], manager);
          } catch (error) {
            if (error instanceof QuotePayloadUnavailableError)
              quoteError(
                410,
                "ATTACHMENT_PAYLOAD_UNAVAILABLE",
                "사진의 임시 보관기간이 끝났습니다. 사진을 다시 선택해 주세요.",
              );
            throw error;
          }
          return { ...existing, replay: true };
        }
        if (
          existing.upload_claimed_at &&
          new Date(existing.upload_claimed_at).getTime() >
            Date.now() - 5 * 60 * 1000
        )
          quoteError(
            409,
            "ATTACHMENT_UPLOAD_IN_PROGRESS",
            "사진을 처리 중입니다. 잠시 후 같은 사진으로 다시 시도해 주세요.",
          );
        // 정상화된 내용과 저장 키가 고정되어 있어 저장소 응답 유실/작업자 중단 후 같은 객체로 안전하게 재시도한다.
        await manager.query(
          "UPDATE quote_attachments SET upload_claim_token=$2,upload_claimed_at=now() WHERE id=$1",
          [existing.id, claimToken],
        );
        return { ...existing, replay: false };
      }
      const [verification] = await manager.query(
        "SELECT id FROM quote_business_verifications WHERE session_id=$1 AND expires_at>now() LIMIT 1",
        [sessionId],
      );
      if (!verification)
        quoteError(
          422,
          "VERIFICATION_REQUIRED",
          "사업자 정보를 먼저 확인해 주세요.",
        );
      const [{ count }] = await manager.query(
        "SELECT count(*)::int AS count FROM quote_attachments WHERE session_id=$1 AND request_id IS NULL AND state!='DELETING'",
        [sessionId],
      );
      if (count >= 3 || session.upload_count >= 12)
        quoteError(
          429,
          "ATTACHMENT_LIMIT",
          "사진은 전체 3장까지 첨부할 수 있습니다.",
        );
      await manager.query(
        "UPDATE quote_sessions SET upload_count=upload_count+1 WHERE id=$1",
        [sessionId],
      );
      const id = randomUUID();
      const [created] = await manager.query(
        "INSERT INTO quote_attachments(id,session_id,client_attachment_id,source_hash,source_size,upload_claim_token,upload_claimed_at,storage_key,name,mime_type,size,sha256,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8,'image/jpeg',0,'','UPLOADING',now()+interval '24 hours') RETURNING *",
        [
          id,
          sessionId,
          clientAttachmentId,
          sourceHash,
          file.buffer.length,
          claimToken,
          `quote/${id}.jpg`,
          `photo-${id.slice(0, 8)}.jpg`,
        ],
      );
      return { ...created, replay: false };
    });
    const response = (row: any) => ({
      id: row.id,
      name: row.name,
      mimeType: row.mime_type,
      size: row.size,
    });
    if (reservation.replay) return response(reservation);
    try {
      const image = await prepareQuoteImage(file);
      await this.storage.put(reservation.storage_key, image.buffer);
      // TypeORM의 UPDATE raw 결과는 [rows,count]이므로 공개 계약은 SELECT 결과에서 명시적으로 만든다.
      await this.db.query(
        "UPDATE quote_attachments SET state='READY',size=$2,sha256=$3,upload_claim_token=NULL,upload_claimed_at=NULL WHERE id=$1 AND state='UPLOADING' AND upload_claim_token=$4",
        [
          reservation.id,
          image.buffer.length,
          tokenHash(image.buffer.toString("base64")),
          claimToken,
        ],
      );
      const [saved] = await this.db.query(
        "SELECT * FROM quote_attachments WHERE id=$1",
        [reservation.id],
      );
      if (!saved || saved.state !== "READY" || saved.request_id)
        quoteError(
          409,
          "ATTACHMENT_UPLOAD_IN_PROGRESS",
          "사진 처리 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.",
        );
      return response(saved);
    } catch (error) {
      const invalidImage =
        error instanceof HttpException && error.getStatus() === 400;
      await this.db.query(
        "UPDATE quote_attachments SET upload_claim_token=NULL,upload_claimed_at=NULL,state=CASE WHEN $3 THEN 'DELETING' ELSE state END,expires_at=CASE WHEN $3 THEN now() ELSE expires_at END WHERE id=$1 AND state='UPLOADING' AND upload_claim_token=$2",
        [reservation.id, claimToken, invalidImage],
      );
      if (error instanceof HttpException) throw error;
      quoteError(
        503,
        "ATTACHMENT_UNAVAILABLE",
        "사진을 저장하지 못했습니다. 잠시 후 같은 사진으로 다시 시도해 주세요.",
      );
    }
  }
  async remove(sessionId: string, id: string) {
    await this.db.transaction(async (manager) => {
      await this.sessions.lock(manager, sessionId);
      const [attachment] = await manager.query(
        "SELECT * FROM quote_attachments WHERE id=$1 FOR UPDATE",
        [id],
      );
      // 삭제 응답 유실 뒤 같은 요청을 반복할 수 있다. 타 세션/접수된 사진의 소유권 검사는 그대로 유지한다.
      if (!attachment) return;
      if (
        attachment.session_id === sessionId &&
        !attachment.request_id &&
        attachment.state === "DELETING"
      )
        return;
      assertAttachmentOwnership(attachment, sessionId);
      await manager.query(
        "UPDATE quote_attachments SET state='DELETING',expires_at=now() WHERE id=$1",
        [id],
      );
    });
    return { success: true };
  }
}
