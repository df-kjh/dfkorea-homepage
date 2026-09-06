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
import { TenderDocumentStatus } from "../domain/tender-analysis.enums";
import { Tender } from "./tender.entity";

@Entity("tender_documents")
@Unique("UQ_tender_document_tender_identity", [
  "tenderId",
  "sourceDocumentIdentity",
])
@Index("IDX_tender_document_tender_status", ["tenderId", "status"])
export class TenderDocument {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  tenderId: string;

  @Column({ type: "varchar" })
  sourceDocumentIdentity: string;

  @Column({ type: "varchar" })
  displayName: string;

  @Column({ type: "varchar" })
  sourceUrl: string;

  @Column({ type: "varchar", nullable: true })
  mimeType: string | null;

  @Column({ type: "varchar", nullable: true })
  format: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  contentHash: string | null;

  @Column({ type: "varchar", default: TenderDocumentStatus.PENDING })
  status: TenderDocumentStatus;

  @Column({ type: "varchar", nullable: true })
  errorCode: string | null;

  @Column({ type: "jsonb", nullable: true })
  textBlocks: Record<string, unknown>[] | null;

  @Column({ type: "jsonb", nullable: true })
  tableBlocks: Record<string, unknown>[] | null;

  @Column({ type: "jsonb", nullable: true })
  extractionMetadata: Record<string, unknown> | null;

  @Column({ type: "timestamptz", nullable: true })
  extractedAt: Date | null;

  @ManyToOne(() => Tender, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "tenderId",
    foreignKeyConstraintName: "FK_tender_document_tender",
  })
  tender: Tender;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
