export default defineNuxtRouteMiddleware(async () => {
  const business = useBusinessStore()

  try {
    await business.loadMemberships()

    if (!business.memberships.length) return navigateTo('/onboarding')

    if (import.meta.client) {
      const valid = await business.validateStoredBusiness()
      if (!valid) return navigateTo({ path: '/onboarding', query: { reason: 'invalid-business' } })
    }
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'No pudimos cargar tus negocios.',
      cause: error,
    })
  }
})
