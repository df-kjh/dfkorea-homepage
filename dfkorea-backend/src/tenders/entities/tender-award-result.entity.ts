import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity("tender_award_results")
@Unique("UQ_tender_award_result_identity", [
  "source",
  "sourceNoticeId",
  "revision",
  "productClassification",
  "openedAt",
])
@Index("IDX_tender_award_result_opened_at", ["openedAt"])
@Index("IDX_tender_award_result_classification_method_region", [
  "productClassification",
  "awardMethod",
  "region",
])
export class TenderAwardResult {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  source: string;

  @Column({ type: "varchar" })
  sourceNoticeId: string;

  @Column({ type: "varchar" })
  revision: string;

  @Column({ type: "varchar" })
  productClassification: string;

  @Column({ type: "varchar", nullable: true })
  productGroup: string | null;

  @Column({ type: "varchar", nullable: true })
  awardMethod: string | null;

  @Column({ type: "varchar", nullable: true })
  region: string | null;

  @Column({ type: "timestamptz" })
  openedAt: Date;

  @Column({ type: "numeric", precision: 20, scale: 2, nullable: true })
  basisAmount: string | null;

  @Column({ type: "numeric", precision: 20, scale: 2, nullable: true })
  expectedPrice: string | null;

  @Column({ type: "numeric", precision: 20, scale: 2, nullable: true })
  winningAmount: string | null;

  @Column({ type: "numeric", precision: 10, scale: 6, nullable: true })
  adjustmentRate: string | null;

  @Column({ type: "numeric", precision: 10, scale: 6, nullable: true })
  winningRate: string | null;

  @Column({ type: "boolean", default: false })
  isFinalAward: boolean;

  @Column({ type: "boolean", default: false })
  isFailedBid: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  collectedAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
