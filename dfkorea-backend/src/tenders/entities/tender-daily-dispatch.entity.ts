import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { DailyDispatchStatus } from "../domain/tender.enums";

@Entity("tender_daily_dispatches")
@Unique("UQ_tender_daily_dispatch_business_date", ["businessDate"])
@Index("IDX_tender_daily_dispatch_status", ["status"])
export class TenderDailyDispatch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "date" })
  businessDate: string;

  @Column({ type: "varchar", length: 5 })
  deliveryTime: string;

  @Column({ type: "varchar", default: DailyDispatchStatus.CLAIMED })
  status: DailyDispatchStatus;

  @Column({ type: "timestamptz" })
  claimedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
