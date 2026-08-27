import {
  Column,
  CreateDateColumn,
  Entity,
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
export class TenderRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'varchar' })
  email: string;

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
