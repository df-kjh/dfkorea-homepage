import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import {
  TenderAnalysisStatus,
  TenderSuitability,
} from "../domain/tender-analysis.enums";
import { Tender } from "./tender.entity";

@Entity("tender_analyses")
@Unique("UQ_tender_analysis_tender", ["tenderId"])
@Index("IDX_tender_analysis_status_lease", ["status", "leaseExpiresAt"])
export class TenderAnalysis {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  tenderId: string;

  @Column({ type: "varchar", length: 64 })
  tenderFingerprint: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  documentFingerprint: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  companyProfileFingerprint: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  productCatalogFingerprint: string | null;

  @Column({ type: "varchar" })
  analyzerVersion: string;

  @Column({ type: "varchar", default: TenderAnalysisStatus.PENDING })
  status: TenderAnalysisStatus;

  @Column({ type: "varchar", nullable: true })
  suitability: TenderSuitability | null;

  @Column({ type: "numeric", precision: 5, scale: 2, nullable: true })
  specificationScore: string | null;

  @Column({ type: "integer", default: 0 })
  comparableRequirementCount: number;

  @Column({ type: "integer", default: 0 })
  satisfiedRequirementCount: number;

  @Column({ type: "integer", default: 0 })
  unsatisfiedRequirementCount: number;

  @Column({ type: "integer", default: 0 })
  unknownRequirementCount: number;

  @Column({ type: "jsonb", nullable: true })
  requirements: Record<string, unknown>[] | null;

  @Column({ type: "jsonb", nullable: true })
  certificationAnalysis: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  participationAnalysis: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  priceAnalysis: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  evidence: Record<string, unknown>[] | null;

  @Column({ type: "uuid", nullable: true })
  processingToken: string | null;

  @Column({ type: "timestamptz", nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  errorCode: string | null;

  @Column({ type: "timestamptz", nullable: true })
  analyzedAt: Date | null;

  @ManyToOne(() => Tender, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "tenderId",
    foreignKeyConstraintName: "FK_tender_analysis_tender",
  })
  tender: Tender;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
