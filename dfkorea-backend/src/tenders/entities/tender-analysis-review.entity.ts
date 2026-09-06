import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Tender } from "./tender.entity";
import { TenderAnalysis } from "./tender-analysis.entity";

@Entity("tender_analysis_reviews")
export class TenderAnalysisReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  tenderId: string;

  @Column({ type: "uuid", nullable: true })
  analysisId: string | null;

  @Column({ type: "varchar", length: 64 })
  analysisFingerprint: string;

  @Column({ type: "boolean", default: false })
  completed: boolean;

  @Column({ type: "varchar", length: 2000, nullable: true })
  note: string | null;

  @Column({ type: "integer", nullable: true })
  reviewerAdminId: number | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => Tender, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "tenderId",
    foreignKeyConstraintName: "FK_tender_analysis_review_tender",
  })
  tender: Tender;

  // A review preserves the historic fingerprint even when the current analysis is replaced.
  @ManyToOne(() => TenderAnalysis, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({
    name: "analysisId",
    foreignKeyConstraintName: "FK_tender_analysis_review_analysis",
  })
  analysis: TenderAnalysis | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
