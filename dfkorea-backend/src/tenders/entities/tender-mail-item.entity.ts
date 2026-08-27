import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { MailItemStatus } from '../domain/tender.enums';
import { Tender } from './tender.entity';
import { TenderMailDelivery } from './tender-mail-delivery.entity';
import { TenderRecipient } from './tender-recipient.entity';

@Entity('tender_mail_items')
@Unique('UQ_tender_mail_item_recipient_tender', ['recipientId', 'tenderId'])
export class TenderMailItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'uuid' })
  tenderId: string;

  @Column({ type: 'varchar', default: MailItemStatus.PENDING })
  status: MailItemStatus;

  @Column({ type: 'uuid', nullable: true })
  lastDeliveryId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @ManyToOne(() => TenderRecipient, (recipient) => recipient.mailItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipientId' })
  recipient: TenderRecipient;

  @ManyToOne(() => Tender, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenderId' })
  tender: Tender;

  @ManyToOne(() => TenderMailDelivery, (delivery) => delivery.mailItems, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'lastDeliveryId' })
  lastDelivery: TenderMailDelivery | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
