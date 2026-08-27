/**
 * 날짜 문자열을 한국 형식으로 포맷팅합니다.
 * @param dateString - ISO 형식의 날짜 문자열
 * @returns 포맷팅된 날짜 문자열 (예: 2024-03-15)
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date
    .toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\. /g, '-')
    .replace('.', '')
}

/**
 * 날짜 문자열을 상대적인 시간으로 표시합니다 (예: "방금 전", "3시간 전").
 * @param dateString - ISO 형식의 날짜 문자열
 * @returns 상대적 시간 문자열
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return '방금 전'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}일 전`
  }

  return formatDate(dateString)
}
