import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TenderMailItem } from './tender-mail-item.entity';
import { TenderSubscription } from './tender-subscription.entity';

@Entity('tender_recipients')
@Unique('UQ_tender_recipient_email', ['email'])
@Index('IDX_tender_recipient_subscription_active', ['subscriptionId', 'isActive'])
export class TenderRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => TenderSubscription, (subscription) => subscription.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: TenderSubscription;

  @OneToMany(() => TenderMailItem, (mailItem) => mailItem.recipient)
  mailItems: TenderMailItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
