export const useAuthStore = defineStore('auth', () => {
  const user = useSupabaseUser()
  const session = useSupabaseSession()

  /**
   * Distingue el cierre de sesión que pidió el usuario del que impone el
   * servidor cuando el token vence. Sin esta bandera los dos llegan como el
   * mismo evento `SIGNED_OUT` y el usuario que pulsa «Cerrar sesión» vería un
   * aviso de sesión expirada que no le corresponde.
   */
  const signingOut = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value))
  const email = computed(() => typeof user.value?.email === 'string' ? user.value.email : null)

  function beginSignOut() {
    signingOut.value = true
  }

  function endSignOut() {
    signingOut.value = false
  }

  return {
    user,
    session,
    signingOut,
    isAuthenticated,
    email,
    beginSignOut,
    endSignOut,
  }
})
