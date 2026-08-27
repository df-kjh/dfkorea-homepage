import axios from 'axios'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getServerValidationMessage = (error: unknown): string | null => {
  if (!axios.isAxiosError(error) || !isRecord(error.response?.data)) return null
  const message = error.response.data.message
  if (typeof message === 'string' && message.trim()) return message
  if (
    Array.isArray(message) &&
    message.length > 0 &&
    message.every((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  ) {
    return message.join(' ')
  }
  return null
}
