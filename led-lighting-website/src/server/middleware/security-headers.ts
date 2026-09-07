import { defineEventHandler, getRequestProtocol, getRequestURL, setResponseHeaders } from 'h3'
import { securityHeaders } from '../utils/security-headers'

export default defineEventHandler((event) => {
  setResponseHeaders(
    event,
    securityHeaders(
      getRequestURL(event).pathname,
      process.env.NODE_ENV === 'production',
      // Vercel terminates TLS before Nitro; its forwarded protocol represents browser transport.
      getRequestProtocol(event, { xForwardedProto: true }),
    ),
  )
})
