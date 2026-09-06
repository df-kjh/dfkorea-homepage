import axios from 'axios'
import { effectScope, reactive, watch } from 'vue'
import type { Product } from '@/types'
import type { QuoteItem } from '@/types/quote'
import {
  addItem,
  businessFingerprint,
  createDraft,
  updateCompany,
  validateCompany,
  validateItem,
  validatePhoto,
  validDate,
} from './quote-draft'
import { isExpiredQuoteError, quoteError, quotesAPI } from '@/api/quotes'

function createController() {
  const draft = reactive(createDraft())
  let opener: HTMLElement | null = null
  let verifyController: AbortController | null = null
  let verificationExpiryTimer: ReturnType<typeof setTimeout> | undefined
  let verificationRevision = 0
  let sessionPromise: Promise<void> | null = null
  const uid = () => crypto.randomUUID()
  const isVerified = () =>
    !!draft.verification && Date.parse(draft.verification.expiresAt) > Date.now()
  // 작성 상태는 라우트 컴포넌트 수명보다 오래 유지되므로 검증 감시도 분리된 범위에서 실행한다.
  effectScope(true).run(() => {
    watch(
      () => businessFingerprint(draft.company),
      () => {
        draft.verification = null
        verificationRevision++
        verifyController?.abort()
      },
      { flush: 'sync' },
    )
    watch(
      () => draft.consent,
      (value) => {
        if (!value) {
          draft.verification = null
          verificationRevision++
          verifyController?.abort()
        }
      },
    )
    watch(
      () => draft.verification?.expiresAt,
      (expiresAt) => {
        clearTimeout(verificationExpiryTimer)
        verificationExpiryTimer = undefined
        if (!expiresAt) return
        const remaining = Date.parse(expiresAt) - Date.now()
        if (!Number.isFinite(remaining) || remaining <= 0) {
          draft.verification = null
          return
        }
        verificationExpiryTimer = setTimeout(() => {
          if (draft.verification?.expiresAt === expiresAt) draft.verification = null
        }, remaining)
      },
      { flush: 'sync' },
    )
  })
  function open(event?: Event) {
    const target = event?.currentTarget
    opener =
      target instanceof HTMLElement
        ? target
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    draft.open = true
    void ensureSession().catch((error) => {
      draft.error = quoteError(error)
    })
  }
  function close() {
    draft.open = false
    queueMicrotask(() => {
      if (opener?.isConnected) opener.focus()
      else document.getElementById('quote-launcher')?.focus()
    })
  }
  async function ensureSession() {
    if (draft.session && Date.parse(draft.session.expiresAt) > Date.now()) return
    if (draft.pendingSubmission)
      throw new Error(
        '이전 요청의 접수 결과를 확인할 시간이 지났습니다. 입력을 보관한 채 전화 또는 이메일로 접수 여부를 문의해 주세요.',
      )
    if (sessionPromise) return sessionPromise
    sessionPromise = (async () => {
      const { data } = await quotesAPI.session()
      const previousVersion = draft.session?.privacy.version
      draft.session = data
      draft.verification = null
      // 만료 세션의 파일은 새 세션에서 재사용할 수 없다. 원본을 보관하고 다시 업로드한다.
      draft.photos.forEach((photo) => {
        photo.attachmentId = undefined
      })
      if (previousVersion && previousVersion !== data.privacy.version) draft.consent = false
    })().finally(() => {
      sessionPromise = null
    })
    return sessionPromise
  }
  async function verify() {
    draft.error = validateCompany(draft.company, true)
    if (draft.error) return
    if (!draft.consent) {
      draft.error = '개인정보 수집·이용에 동의해 주세요.'
      return
    }
    if (draft.busy) return
    draft.busy = true
    try {
      await ensureSession()
      if (!draft.consent) {
        draft.error = '변경된 개인정보 안내를 확인하고 동의해 주세요.'
        return
      }
      const revision = ++verificationRevision
      verifyController?.abort()
      verifyController = new AbortController()
      const { data } = await quotesAPI.verify(
        draft.session!.sessionToken,
        draft.company,
        draft.session!.privacy.version,
        verifyController.signal,
      )
      if (revision === verificationRevision && draft.consent) draft.verification = data
    } catch (error) {
      if (!verifyController?.signal.aborted) draft.error = quoteError(error)
    } finally {
      draft.busy = false
    }
  }
  function add(item: QuoteItem) {
    try {
      draft.items = addItem(draft.items, item)
      draft.error = ''
      return true
    } catch (error) {
      draft.error = quoteError(error)
      return false
    }
  }
  function addProduct(product: Product, event?: Event) {
    if (draft.pendingSubmission || draft.reference || draft.busy) {
      open(event)
      return
    }
    add({
      clientId: uid(),
      kind: 'catalog',
      productId: product.id,
      name: product.name,
      modelName: product.modelName,
      quantity: 1,
      certifications: [],
      options: [],
      attachmentIds: [],
    })
    draft.step = 1
    open(event)
  }
  async function deletePhoto(id: string) {
    const photo = draft.photos.find((entry) => entry.clientId === id)
    if (!photo) return
    if (photo.attachmentId && draft.session)
      await quotesAPI.remove(draft.session.sessionToken, photo.attachmentId)
    URL.revokeObjectURL(photo.preview)
    draft.photos = draft.photos.filter((entry) => entry.clientId !== id)
  }
  async function mutatePhotos(action: () => Promise<void>) {
    if (draft.busy || draft.pendingSubmission) return
    // 원격 삭제/교체 중에는 제출과 단계 이동을 막아 이미 삭제 중인 첨부를 전송하지 않는다.
    draft.busy = true
    try {
      await action()
      draft.error = ''
    } catch (error) {
      draft.error = quoteError(error)
    } finally {
      draft.busy = false
    }
  }
  async function removePhoto(id: string) {
    await mutatePhotos(() => deletePhoto(id))
  }
  async function removeItem(id: string) {
    await mutatePhotos(async () => {
      for (const photo of draft.photos.filter((entry) => entry.itemId === id))
        await deletePhoto(photo.clientId)
      draft.items = draft.items.filter((item) => item.clientId !== id)
    })
  }
  function addPhoto(itemId: string, file: File) {
    const error = validatePhoto(file, draft.photos.length)
    if (error) {
      draft.error = error
      return false
    }
    draft.photos.push({ clientId: uid(), itemId, file, preview: URL.createObjectURL(file) })
    draft.error = ''
    return true
  }
  async function replacePhoto(id: string, file: File) {
    const error = validatePhoto(file, draft.photos.length - 1)
    if (error) {
      draft.error = error
      return
    }
    const photo = draft.photos.find((entry) => entry.clientId === id)
    if (!photo) return
    await mutatePhotos(async () => {
      await deletePhoto(id)
      addPhoto(photo.itemId, file)
    })
  }

  function next() {
    if (draft.busy) return
    draft.error = ''
    if (draft.step === 1) {
      draft.error = validateCompany(draft.company)
      if (!draft.error && !isVerified()) draft.error = '사업자 정보를 확인한 후 진행해 주세요.'
      if (!draft.error && !draft.consent) draft.error = '개인정보 수집·이용에 동의해 주세요.'
    } else if (draft.step === 2)
      draft.error = !draft.items.length
        ? '제품을 한 개 이상 담아 주세요.'
        : draft.items.map(validateItem).find(Boolean) || ''
    if (!draft.error && draft.step < 3) draft.step = (draft.step + 1) as 2 | 3
  }
  async function submit() {
    if (draft.busy || draft.reference) return
    draft.error = ''
    if (!draft.pendingSubmission) {
      draft.error =
        validateCompany(draft.company) ||
        (!isVerified()
          ? '사업자 정보 확인 시간이 지났습니다. 기업 정보에서 다시 확인해 주세요.'
          : '') ||
        (!draft.consent ? '개인정보 수집·이용에 동의해 주세요.' : '') ||
        (!draft.items.length
          ? '제품을 한 개 이상 담아 주세요.'
          : draft.items.map(validateItem).find(Boolean) || '')
      if (draft.notes.length > 2000) draft.error = '추가 요청사항은 2,000자 이내로 입력해 주세요.'
      if (draft.requestedDeliveryDate && !validDate(draft.requestedDeliveryDate))
        draft.error = '희망 납기일을 확인해 주세요.'
      if (draft.error) return
    }
    draft.busy = true
    try {
      if (!draft.session) throw new Error('기업 정보에서 사업자 정보를 다시 확인해 주세요.')
      if (!draft.pendingSubmission) {
        for (const photo of draft.photos.filter((photo) =>
          draft.items.some((item) => item.clientId === photo.itemId),
        )) {
          if (photo.attachmentId) continue
          try {
            const { data } = await quotesAPI.upload(
              draft.session.sessionToken,
              photo.file,
              photo.clientId,
            )
            photo.attachmentId = data.id
            photo.error = ''
          } catch (error) {
            photo.error = '사진을 전송하지 못했습니다. 다시 보내면 이 사진부터 재시도합니다.'
            throw error
          }
        }
        draft.idempotencyKey ||= uid()
        draft.pendingSubmission = {
          idempotencyKey: draft.idempotencyKey,
          verificationToken: draft.verification!.verificationToken,
          company: {
            ...draft.company,
            companyName: draft.company.companyName.trim(),
            representativeName: draft.company.representativeName.trim(),
            businessNumber: draft.company.businessNumber.replace(/\D/g, ''),
            contactName: draft.company.contactName.trim(),
            email: draft.company.email.trim(),
            phone: draft.company.phone?.trim() || undefined,
          },
          items: draft.items.map((source) => {
            const item = { ...source }
            // 모델명은 표시 전용이며 접수 시 서버의 제품 정보로 스냅샷을 만든다.
            delete item.modelName
            if (item.kind === 'catalog') delete item.name
            return {
              ...item,
              certifications: [...item.certifications],
              options: [...item.options],
              attachmentIds: draft.photos
                .filter((photo) => photo.itemId === item.clientId)
                .map((photo) => photo.attachmentId!),
            }
          }),
          notes: draft.notes.trim() || undefined,
          requestedDeliveryDate: draft.requestedDeliveryDate || undefined,
          consentVersion: draft.session.privacy.version,
        }
      }
      // 시간초과 뒤에는 동일한 원문을 재전송해 접수 중복을 방지한다. 결과 확인 전 편집은 잠근다.
      const { data } = await quotesAPI.submit(draft.session.sessionToken, draft.pendingSubmission)
      draft.reference = data.reference
      draft.photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
      draft.photos = []
    } catch (error) {
      draft.error = quoteError(error)
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      // 명시적인 입력 거절은 접수되지 않은 요청이다. 사용자가 수정할 수 있도록 잠금/키만 해제한다.
      if ([400, 422, 410].includes(status ?? 0)) {
        draft.pendingSubmission = null
        draft.idempotencyKey = ''
      }
      if (status === 410) {
        draft.verification = null
        draft.step = 1
      }
      if (status === 401 && draft.pendingSubmission)
        draft.error =
          '접수 결과를 확인할 시간이 지났습니다. 입력은 보관되어 있습니다. 전화 또는 이메일로 이전 요청의 접수 여부를 문의해 주세요.'
      if (isExpiredQuoteError(error) && !draft.pendingSubmission) {
        draft.verification = null
        draft.session = null
        draft.step = 1
      }
    } finally {
      draft.busy = false
    }
  }
  function reset() {
    if (!draft.reference) return
    verificationRevision++
    verifyController?.abort()
    Object.assign(draft, createDraft(), { open: true })
    void ensureSession().catch((error) => {
      draft.error = quoteError(error)
    })
  }
  return {
    draft,
    open,
    close,
    verify,
    isVerified,
    ensureSession,
    updateCompany: (patch: Parameters<typeof updateCompany>[1]) => updateCompany(draft, patch),
    add,
    addProduct,
    removeItem,
    removePhoto,
    addPhoto,
    replacePhoto,
    next,
    submit,
    reset,
    uid,
  }
}
// 클라이언트에서만 모듈 수명의 메모리를 사용한다. 서버에서는 요청마다 별도 생성하고 Nuxt payload/useState에 개인정보를 직렬화하지 않는다.
let clientController: ReturnType<typeof createController> | undefined
export function useQuoteDraft() {
  if (typeof window === 'undefined') return createController()
  return (clientController ??= createController())
}
