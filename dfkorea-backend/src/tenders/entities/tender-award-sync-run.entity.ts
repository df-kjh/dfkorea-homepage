import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { TenderAwardSyncStatus } from "../domain/tender-analysis.enums";

@Entity("tender_award_sync_runs")
@Unique("UQ_tender_award_sync_run_source_period", [
  "source",
  "periodStart",
  "periodEnd",
])
@Index("IDX_tender_award_sync_run_status_lease", ["status", "leaseExpiresAt"])
export class TenderAwardSyncRun {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  source: string;

  @Column({ type: "date" })
  periodStart: string;

  @Column({ type: "date" })
  periodEnd: string;

  @Column({ type: "varchar", nullable: true })
  cursor: string | null;

  @Column({ type: "varchar", default: TenderAwardSyncStatus.RUNNING })
  status: TenderAwardSyncStatus;

  @Column({ type: "integer", default: 0 })
  fetchedCount: number;

  @Column({ type: "integer", default: 0 })
  storedCount: number;

  @Column({ type: "integer", default: 0 })
  excludedCount: number;

  @Column({ type: "uuid", nullable: true })
  leaseToken: string | null;

  @Column({ type: "timestamptz", nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  errorCode: string | null;

  @Column({ type: "timestamptz", nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
