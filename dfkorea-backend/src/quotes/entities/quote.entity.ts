import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("quote_sessions")
export class QuoteSession {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "text", nullable: false }) token_hash: string;
  @Column({ type: "timestamptz", nullable: false }) expires_at: Date;
  @Column({ type: "integer", nullable: false }) verification_count: number;
  @Column({ type: "integer", nullable: false }) upload_count: number;
  @Column({ type: "integer", nullable: false }) submit_count: number;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_business_verifications")
export class QuoteBusinessVerification {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", nullable: false }) session_id: string;
  @Column({ type: "text", nullable: false }) token_hash: string;
  @Column({ type: "text", nullable: false }) input_hash: string;
  @Column({ type: "text", nullable: false }) consent_version: string;
  @Column({ type: "timestamptz", nullable: false }) verified_at: Date;
  @Column({ type: "timestamptz", nullable: false }) expires_at: Date;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_requests")
export class QuoteRequest {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", nullable: true }) session_id: string | null;
  @Column({ type: "text", nullable: false }) reference: string;
  @Column({ type: "text", nullable: false }) idempotency_key: string;
  @Column({ type: "text", nullable: false }) payload_hash: string;
  @Column({ type: "jsonb", nullable: false }) company: Record<string, any>;
  @Column({ type: "timestamptz", nullable: false }) verified_at: Date;
  @Column({ type: "text", nullable: false }) consent_version: string;
  @Column({ type: "timestamptz", nullable: false }) consented_at: Date;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @Column({ type: "date", nullable: true }) requested_delivery_date:
    | string
    | null;
  @Column({ type: "timestamptz", nullable: false }) expires_at: Date;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_items")
export class QuoteItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", nullable: false }) request_id: string;
  @Column({ type: "text", nullable: false }) client_id: string;
  @Column({ type: "text", nullable: false }) kind: string;
  @Column({ type: "uuid", nullable: true }) product_id: string | null;
  @Column({ type: "jsonb", nullable: false }) snapshot: Record<string, any>;
  @Column({ type: "jsonb", nullable: false }) selected: Record<string, any>;
  @Column({ type: "integer", nullable: false }) quantity: number;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_attachments")
export class QuoteAttachment {
  @Column({ type: "uuid" }) client_attachment_id: string;
  @Column({ type: "text" }) source_hash: string;
  @Column({ type: "integer" }) source_size: number;
  @Column({ type: "uuid", nullable: true }) upload_claim_token: string | null;
  @Column({ type: "timestamptz", nullable: true })
  upload_claimed_at: Date | null;
  @Column({ type: "timestamptz", nullable: true })
  cleanup_retry_at: Date | null;
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", nullable: false }) session_id: string;
  @Column({ type: "uuid", nullable: true }) request_id: string | null;
  @Column({ type: "uuid", nullable: true }) item_id: string | null;
  @Column({ type: "text", nullable: false }) storage_key: string;
  @Column({ type: "text", nullable: false }) name: string;
  @Column({ type: "text", nullable: false }) mime_type: string;
  @Column({ type: "integer", nullable: false }) size: number;
  @Column({ type: "text", nullable: false }) sha256: string;
  @Column({ type: "text", nullable: false }) state: string;
  @Column({ type: "timestamptz", nullable: false }) expires_at: Date;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_mail_deliveries")
export class QuoteMailDelivery {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid", nullable: false }) request_id: string;
  @Column({ type: "text", nullable: false }) status: string;
  @Column({ type: "integer", nullable: false }) attempts: number;
  @Column({ type: "timestamptz", nullable: true }) claimed_at: Date | null;
  @Column({ type: "uuid", nullable: true }) claim_token: string | null;
  @Column({ type: "timestamptz", nullable: false }) next_attempt_at: Date;
  @Column({ type: "text", nullable: true }) error_code: string | null;
  @Column({ type: "timestamptz", nullable: true })
  provider_accepted_at: Date | null;
  @Column({ type: "jsonb", nullable: false }) history: Record<string, any>;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_ip_quotas")
export class QuoteIpQuota {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "text", nullable: false }) ip_hash: string;
  @Column({ type: "timestamptz", nullable: false }) window_start: Date;
  @Column({ type: "integer", nullable: false }) requests: number;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

@Entity("quote_attachment_payloads")
export class QuoteAttachmentPayload {
  @PrimaryColumn({ type: "uuid" }) attachment_id: string;
  @Column({ type: "bytea", select: false }) bytes: Buffer;
  @Column({ type: "timestamptz" }) expires_at: Date;
  @CreateDateColumn({ type: "timestamptz" }) created_at: Date;
}

export const QUOTE_ENTITIES = [
  QuoteAttachmentPayload,
  QuoteSession,
  QuoteBusinessVerification,
  QuoteRequest,
  QuoteItem,
  QuoteAttachment,
  QuoteMailDelivery,
  QuoteIpQuota,
];
