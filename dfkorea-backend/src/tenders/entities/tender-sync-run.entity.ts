import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SyncRunStatus, TenderSource } from '../domain/tender.enums';

@Entity('tender_sync_runs')
@Index('IDX_tender_sync_run_source', ['source'])
@Index('IDX_tender_sync_run_status', ['status'])
export class TenderSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  source: TenderSource;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'varchar', default: SyncRunStatus.RUNNING })
  status: SyncRunStatus;

  @Column({ type: 'integer', default: 0 })
  fetchedCount: number;

  @Column({ type: 'integer', default: 0 })
  createdCount: number;

  @Column({ type: 'integer', default: 0 })
  updatedCount: number;

  @Column({ type: 'integer', default: 0 })
  excludedCount: number;

  @Column({ type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
