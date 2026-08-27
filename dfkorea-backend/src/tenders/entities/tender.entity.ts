import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  ProcurementType,
  TenderRelevance,
  TenderSource,
} from '../domain/tender.enums';

@Entity('tenders')
@Unique('UQ_tender_source_notice_revision', [
  'source',
  'sourceNoticeId',
  'revision',
])
@Index('IDX_tender_registered_at', ['registeredAt'])
@Index('IDX_tender_source', ['source'])
@Index('IDX_tender_relevance', ['relevance'])
@Index('IDX_tender_region', ['region'])
@Index('IDX_tender_procurement_type', ['procurementType'])
export class Tender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  source: TenderSource;

  @Column({ type: 'varchar' })
  sourceNoticeId: string;

  @Column({ type: 'varchar' })
  revision: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  orderingOrganization: string;

  @Column({ type: 'varchar', nullable: true })
  demandOrganization: string | null;

  @Column({ type: 'timestamptz' })
  registeredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  bidStartedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  bidEndedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  region: string | null;

  @Column({ type: 'varchar' })
  procurementType: ProcurementType;

  @Column({ type: 'varchar', nullable: true })
  contractMethod: string | null;

  // PostgreSQL bigint values are returned as strings to avoid JavaScript precision loss.
  @Column({ type: 'bigint', nullable: true })
  estimatedAmount: string | null;

  @Column({ type: 'varchar' })
  sourceUrl: string;

  @Column({ type: 'varchar' })
  relevance: TenderRelevance;

  @Column({ type: 'integer' })
  relevanceScore: number;

  @Column({ type: 'jsonb' })
  relevanceReasons: unknown[];

  @Column({ type: 'jsonb' })
  rawData: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  firstCollectedAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastUpdatedAt: Date;
}
