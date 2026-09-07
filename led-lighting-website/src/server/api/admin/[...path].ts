import { defineEventHandler } from 'h3'
import { createAdminRelayHandler } from '../../utils/admin-relay'

export default defineEventHandler((event) =>
  createAdminRelayHandler(() => {
    const config = useRuntimeConfig(event)
    return {
      adminApiBaseUrl: String(config.adminApiBaseUrl || ''),
      adminOrigin: String(config.adminOrigin || ''),
      production: process.env.NODE_ENV === 'production',
    }
  })(event),
)
