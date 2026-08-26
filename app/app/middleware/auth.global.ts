const ANONYMOUS_ROUTES = new Set(['/login', '/registro', '/recuperar', '/nueva-contrasena'])
const GUEST_ONLY_ROUTES = new Set(['/login', '/registro', '/recuperar'])

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    if (ANONYMOUS_ROUTES.has(to.path)) return

    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  const isConfirmationLanding = to.path === '/login' && to.query.confirmed === '1'
  if (GUEST_ONLY_ROUTES.has(to.path) && !isConfirmationLanding) return navigateTo('/')
})
