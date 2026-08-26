export const useAuthStore = defineStore('auth', () => {
  const user = useSupabaseUser()
  const session = useSupabaseSession()

  const isAuthenticated = computed(() => Boolean(session.value))
  const email = computed(() => typeof user.value?.email === 'string' ? user.value.email : null)

  return {
    user,
    session,
    isAuthenticated,
    email,
  }
})
