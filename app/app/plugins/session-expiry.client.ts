import type { Database } from '~/types/database'
import { goToExpiredSession } from '~/utils/session'

/**
 * Avisa cuando la sesión se cae sola.
 *
 * Supabase cierra la sesión por su cuenta cuando el refresco del token falla,
 * y sin esto el usuario aparecería en el login sin explicación, perdiendo lo
 * que estaba haciendo. Solo actúa si el cierre no lo pidió él.
 */
export default defineNuxtPlugin(() => {
  const client = useSupabaseClient<Database>()
  const auth = useAuthStore()
  const businessStore = useBusinessStore()
  const route = useRoute()

  const { data } = client.auth.onAuthStateChange((event) => {
    if (event !== 'SIGNED_OUT' || auth.signingOut) return
    businessStore.reset()
    goToExpiredSession(route.fullPath)
  })

  // El listener vive lo que viva la aplicación; se suelta al descargarla.
  if (import.meta.hot) import.meta.hot.dispose(() => data.subscription.unsubscribe())
})
