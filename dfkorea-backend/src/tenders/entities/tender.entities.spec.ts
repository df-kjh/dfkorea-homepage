import { getMetadataArgsStorage } from 'typeorm';
import { Tender } from './tender.entity';
import { TenderMailItem } from './tender-mail-item.entity';

describe('tender entity metadata', () => {
  it('deduplicates source notice revisions', () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === Tender &&
        item.name === 'UQ_tender_source_notice_revision',
    );

    expect(unique?.columns).toEqual(['source', 'sourceNoticeId', 'revision']);
  });

  it('tracks one delivery state per recipient and tender', () => {
    const unique = getMetadataArgsStorage().uniques.find(
      (item) =>
        item.target === TenderMailItem &&
        item.name === 'UQ_tender_mail_item_recipient_tender',
    );

    expect(unique?.columns).toEqual(['recipientId', 'tenderId']);
  });
});
