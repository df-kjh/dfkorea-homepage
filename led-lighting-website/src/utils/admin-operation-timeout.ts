export const ADMIN_OPERATION_TIMEOUT_MESSAGE =
  '응답 대기 시간이 지나 작업 완료 여부를 확인하지 못했습니다. 작업이 계속 진행될 수 있으니 결과를 먼저 확인한 뒤 다시 실행해 주세요.'

export function adminOperationTimeoutMessage(error: unknown): string | undefined {
  const failure = error as { response?: { status?: number }; code?: string } | null
  return failure?.response?.status === 504 ||
    ['ECONNABORTED', 'ETIMEDOUT'].includes(failure?.code ?? '')
    ? ADMIN_OPERATION_TIMEOUT_MESSAGE
    : undefined
}
