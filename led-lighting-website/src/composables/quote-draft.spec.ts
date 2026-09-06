import { describe, expect, it } from 'vitest'
import {
  addItem,
  createDraft,
  updateCompany,
  validateCompany,
  validateItem,
  validatePhoto,
  setOpen,
  normalizeSpecValues,
} from './quote-draft'
import type { QuoteItem } from '@/types/quote'
const item = (overrides: Partial<QuoteItem> = {}): QuoteItem => ({
  clientId: 'one',
  kind: 'catalog',
  productId: 'p1',
  quantity: 2,
  certifications: [],
  options: [],
  attachmentIds: [],
  ...overrides,
})
describe('online quote draft', () => {
  it('normalizes custom CSV and rejects spec arrays exceeding the server contract', () => {
    expect(normalizeSpecValues(' KC, KC , 고효율, ')).toEqual(['KC', '고효율'])
    expect(validateItem(item({ certifications: ['KC', 'KC'] }))).toBeTruthy()
    expect(
      validateItem(item({ options: Array.from({ length: 21 }, (_, i) => String(i)) })),
    ).toBeTruthy()
    expect(validateItem(item({ certifications: ['a'.repeat(101)] }))).toBeTruthy()
    expect(validateItem(item({ options: [''] }))).toBeTruthy()
  })

  it('matches the server custom-name and numeric-spec boundaries', () => {
    expect(
      validateItem(
        item({ kind: 'custom', name: 'a'.repeat(100), description: '설명', power: 0.5 }),
      ),
    ).toBe('')
    expect(
      validateItem(item({ kind: 'custom', name: 'a'.repeat(101), description: '설명' })),
    ).toBeTruthy()
    expect(validateItem(item({ power: 1000001 }))).toBeTruthy()
  })
  it('matches the server optional-phone length and leading-character rules', () => {
    const c = {
      companyName: '상호',
      businessNumber: '1234567890',
      representativeName: '대표',
      openingDate: '2020-01-01',
      contactName: '담당',
      email: 'hello@example.com',
    }
    expect(validateCompany({ ...c, phone: '1234567' })).toBe('')
    expect(validateCompany({ ...c, phone: '1'.repeat(25) })).toBe('')
    expect(validateCompany({ ...c, phone: '1'.repeat(26) })).toBeTruthy()
    expect(validateCompany({ ...c, phone: '(032)528-2953' })).toBeTruthy()
  })

  it('retains data and step when minimized and reopened', () => {
    const d = createDraft()
    d.company.companyName = '디에프'
    d.items = [item()]
    d.step = 2
    setOpen(d, false)
    setOpen(d, true)
    expect([d.company.companyName, d.items.length, d.step]).toEqual(['디에프', 1, 2])
  })
  it('never shares private data between drafts', () => {
    const d = createDraft()
    d.company.email = 'private@example.com'
    d.items.push(item())
    expect(createDraft().company.email).toBe('')
    expect(createDraft().items).toEqual([])
  })
  it.each(['companyName', 'businessNumber', 'representativeName', 'openingDate'] as const)(
    'invalidates verification after %s changes',
    (field) => {
      const d = createDraft()
      d.verification = { verificationToken: 'old', expiresAt: '2099-01-01' }
      updateCompany(d, { [field]: 'changed' })
      expect(d.verification).toBeNull()
    },
  )
  it('retains verification when contact changes', () => {
    const d = createDraft()
    d.verification = { verificationToken: 'valid', expiresAt: '2099-01-01' }
    updateCompany(d, { contactName: '담당자' })
    expect(d.verification?.verificationToken).toBe('valid')
  })
  it('merges equal chosen specifications regardless of option order and separates differing specs', () => {
    const original = item({ options: ['센서', '디밍'] })
    expect(addItem([original], item({ clientId: 'two', options: ['디밍', '센서'] }))).toEqual([
      { ...original, quantity: 4 },
    ])
    expect(addItem([original], item({ power: 40 })).length).toBe(2)
    expect(addItem([item()], item({ certifications: ['KC'] })).length).toBe(2)
  })
  it('rejects merged overflow and a 21st distinct item without mutation', () => {
    const items = [item({ quantity: 999999 })]
    expect(() => addItem(items, item())).toThrow()
    expect(items[0]?.quantity).toBe(999999)
    const full = Array.from({ length: 20 }, (_, i) => item({ productId: String(i) }))
    expect(() => addItem(full, item({ productId: 'new' }))).toThrow()
    expect(addItem(full, item({ productId: '0' })).length).toBe(20)
  })
  it.each([0, -1, 1.5, 1000000, Number.NaN])('rejects invalid quantity %s', (quantity) =>
    expect(validateItem(item({ quantity }))).toBeTruthy(),
  )
  it('requires a custom description but allows unknown optional specs', () => {
    expect(validateItem(item({ kind: 'custom', name: '투광등', description: '' }))).toBeTruthy()
    expect(
      validateItem(item({ kind: 'custom', name: '투광등', description: '주차장 설치용' })),
    ).toBe('')
  })
  it('blocks a fourth photo, oversize and unsupported images', () => {
    const jpg = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    expect(validatePhoto(jpg, 2)).toBe('')
    expect(validatePhoto(jpg, 3)).toBeTruthy()
    expect(validatePhoto(new File(['x'], 'x.svg', { type: 'image/svg+xml' }), 0)).toBeTruthy()
    expect(
      validatePhoto(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
        0,
      ),
    ).toBeTruthy()
  })
  it('validates required company fields and optional phone including real calendar dates', () => {
    const c = {
      companyName: '상호',
      businessNumber: '1234567890',
      representativeName: '대표',
      openingDate: '2020-01-01',
      contactName: '담당',
      email: 'hello@example.com',
      phone: '',
    }
    expect(validateCompany(c)).toBe('')
    expect(validateCompany({ ...c, email: 'invalid' })).toBeTruthy()
    expect(validateCompany({ ...c, phone: 'abc' })).toBeTruthy()
    expect(validateCompany({ ...c, openingDate: '2020-02-31' })).toBeTruthy()
  })
})
