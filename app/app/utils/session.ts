/**
 * Salida única hacia la pantalla de sesión expirada.
 *
 * La expiración puede detectarse por dos caminos —el evento `SIGNED_OUT` de
 * Supabase o una consulta que responde con el JWT vencido—, así que ambos
 * terminan aquí para que el usuario vea siempre lo mismo y solo una vez.
 */

/**
 * Rutas donde el aviso no aplica: quien está registrándose o recuperando la
 * contraseña no tiene ninguna sesión que se le haya caído. `/login` sí entra,
 * porque al recargar una pestaña con la sesión muerta el middleware lleva allí
 * antes de que Supabase avise, y el aviso hay que añadirlo después.
 */
const IGNORED_ROUTES = new Set(['/registro', '/recuperar', '/nueva-contrasena'])

let redirecting = false

/** Devuelve si llegó a redirigir, para que quien llama decida si además avisa. */
export function goToExpiredSession(currentPath: string) {
  const [path = '', search = ''] = currentPath.split('?')
  if (redirecting || IGNORED_ROUTES.has(path)) return false
  // Ya está avisado: no hace falta volver a navegar.
  if (path === '/login' && search.includes('expired=1')) return false

  const query = new URLSearchParams(search)
  // Se conserva a dónde iba para poder devolverlo tras volver a entrar.
  const redirect = path === '/login' ? query.get('redirect') ?? '/' : currentPath

  redirecting = true
  Promise.resolve(navigateTo({ path: '/login', query: { expired: '1', redirect }, replace: true }))
    .finally(() => { redirecting = false })
  return true
}
