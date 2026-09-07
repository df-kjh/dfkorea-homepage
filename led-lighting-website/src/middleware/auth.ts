export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return
  try {
    // SSR forwards the incoming cookie through Nuxt's request-scoped fetch.
    // A forged or expired cookie cannot pass the backend identity check.
    await useRequestFetch()('/api/admin/auth/session')
  } catch {
    return navigateTo('/admin/login')
  }
})
