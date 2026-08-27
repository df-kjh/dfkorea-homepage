import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenderRecipient } from './tender-recipient.entity';

@Entity('tender_subscriptions')
export class TenderSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 5, default: '09:00' })
  deliveryTime: string;

  @OneToMany(() => TenderRecipient, (recipient) => recipient.subscription)
  recipients: TenderRecipient[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
