const KST_TIME_ZONE = 'Asia/Seoul'

const kstParts = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export const formatKstDate = (value: string | Date): string => {
  const parts = kstParts(value)
  return `${parts.year}. ${Number(parts.month)}. ${Number(parts.day)}.`
}

export const formatKstDateTime = (value: string | Date): string => {
  const parts = kstParts(value)
  return `${parts.year}. ${Number(parts.month)}. ${Number(parts.day)}. ${parts.hour}:${parts.minute}`
}

export const formatTenderAmount = (value: string | null): string => {
  if (value === null || !/^-?\d+$/.test(value)) return '-'
  return `${new Intl.NumberFormat('ko-KR').format(BigInt(value))}원`
}
