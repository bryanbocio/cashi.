const ANONYMOUS_ROUTES = new Set(['/login', '/registro', '/recuperar', '/nueva-contrasena'])
const GUEST_ONLY_ROUTES = new Set(['/login', '/registro', '/recuperar'])

/**
 * Marca que este navegador llegó a tener sesión.
 *
 * Al recargar con la sesión ya muerta no llega ningún evento de Supabase: el
 * middleware redirige antes. Sin esta marca no habría forma de distinguir a
 * quien se le venció la sesión de quien entra por primera vez, y los dos verían
 * el mismo login mudo. Es una cookie, no `localStorage`, porque esta decisión
 * también se toma en el servidor.
 */
const SESSION_SEEN_COOKIE = 'cashi.session-seen'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  const seenSession = useCookie(SESSION_SEEN_COOKIE, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  if (!auth.isAuthenticated) {
    if (ANONYMOUS_ROUTES.has(to.path) || to.path.startsWith('/catalogo/')) return

    // La marca se consume: el aviso se da una vez, no en cada intento.
    const expired = seenSession.value === '1'
    if (expired) seenSession.value = null

    return navigateTo({
      path: '/login',
      query: expired ? { expired: '1', redirect: to.fullPath } : { redirect: to.fullPath },
    })
  }

  seenSession.value = '1'

  const isConfirmationLanding = to.path === '/login' && to.query.confirmed === '1'
  if (GUEST_ONLY_ROUTES.has(to.path) && !isConfirmationLanding) return navigateTo('/')
})
