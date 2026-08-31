import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { MailDeliveryStatus } from "../domain/tender.enums";
import { TenderMailItem } from "./tender-mail-item.entity";
import { TenderDailyDispatch } from "./tender-daily-dispatch.entity";
import { TenderRecipient } from "./tender-recipient.entity";

@Entity("tender_mail_deliveries")
@Index("IDX_tender_mail_delivery_status_next_retry_at", [
  "status",
  "nextRetryAt",
])
@Index("IDX_tender_mail_delivery_recipient_target_date", [
  "recipientEmail",
  "targetDate",
])
@Index("IDX_tender_mail_delivery_status_claimed_at", ["status", "claimedAt"])
@Unique("UQ_tender_mail_delivery_dispatch_recipient", [
  "dailyDispatchId",
  "recipientId",
])
export class TenderMailDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  dailyDispatchId: string | null;

  @Column({ type: "uuid", nullable: true })
  recipientId: string | null;

  @Column({ type: "varchar" })
  recipientEmail: string;

  @Column({ type: "date" })
  targetDate: string;

  @Column({ type: "integer", default: 0 })
  attemptCount: number;

  @Column({ type: "varchar", default: MailDeliveryStatus.PENDING })
  status: MailDeliveryStatus;

  @Column({ type: "timestamptz", nullable: true })
  nextRetryAt: Date | null;

  // A claim is durable before provider delivery starts. If a worker crashes before it can
  // record the result, the retry scanner can recover this lease explicitly.
  @Column({ type: "timestamptz", nullable: true })
  claimedAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  providerMessageId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  failedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  uncertainAt: Date | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => TenderDailyDispatch, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({
    name: "dailyDispatchId",
    foreignKeyConstraintName: "FK_tender_mail_delivery_daily_dispatch",
  })
  dailyDispatch: TenderDailyDispatch | null;

  @ManyToOne(() => TenderRecipient, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({
    name: "recipientId",
    foreignKeyConstraintName: "FK_tender_mail_delivery_recipient",
  })
  recipient: TenderRecipient | null;

  @OneToMany(() => TenderMailItem, (mailItem) => mailItem.lastDelivery)
  mailItems: TenderMailItem[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
