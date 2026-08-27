import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { MailDeliveryStatus } from "../domain/tender.enums";
import { TenderMailItem } from "./tender-mail-item.entity";

@Entity("tender_mail_deliveries")
@Index("IDX_tender_mail_delivery_status_next_retry_at", [
  "status",
  "nextRetryAt",
])
@Index("IDX_tender_mail_delivery_recipient_target_date", [
  "recipientEmail",
  "targetDate",
])
export class TenderMailDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

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

  // A claim is durable before SMTP starts. If a worker crashes before it can
  // record the result, the retry scanner can recover this lease explicitly.
  @Column({ type: "timestamptz", nullable: true })
  claimedAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  smtpMessageId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  failedAt: Date | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @OneToMany(() => TenderMailItem, (mailItem) => mailItem.lastDelivery)
  mailItems: TenderMailItem[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
