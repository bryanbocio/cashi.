import type { Database } from '~/types/database'

export const ACTIVE_BUSINESS_STORAGE_KEY = 'cashi.active-business-id'

type BusinessSummary = Pick<
  Database['public']['Tables']['business']['Row'],
  'address' | 'currency' | 'id' | 'logo_path' | 'name' | 'nit' | 'phone' | 'timezone'
>

export type BusinessMembership = Pick<
  Database['public']['Tables']['membership']['Row'],
  'business_id' | 'id' | 'role'
> & {
  business: BusinessSummary | null
}

export const useBusinessStore = defineStore('business', () => {
  const client = useSupabaseClient<Database>()
  const memberships = ref<BusinessMembership[]>([])
  const activeBusinessId = ref<string | null>(null)
  const initialized = ref(false)
  const storageValidated = ref(false)
  const invalidStoredBusiness = ref(false)
  let loadingPromise: Promise<void> | null = null

  const activeMembership = computed(() => (
    memberships.value.find(item => item.business_id === activeBusinessId.value) ?? null
  ))
  const activeBusiness = computed(() => activeMembership.value?.business ?? null)

  async function loadMemberships(force = false) {
    if (initialized.value && !force) return
    if (loadingPromise) return loadingPromise

    loadingPromise = (async () => {
      const previousBusinessId = activeBusinessId.value
      const { data, error } = await client
        .from('membership')
        .select('id, business_id, role, business(id, name, nit, phone, address, currency, timezone, logo_path)')
        .order('created_at', { ascending: true })

      if (error) throw error

      memberships.value = (data ?? []) as BusinessMembership[]
      activeBusinessId.value = memberships.value.some(item => item.business_id === previousBusinessId)
        ? previousBusinessId
        : memberships.value[0]?.business_id ?? null
      initialized.value = true
    })()

    try {
      await loadingPromise
    } finally {
      loadingPromise = null
    }
  }

  async function validateStoredBusiness() {
    if (!import.meta.client) return Boolean(activeBusinessId.value)
    if (storageValidated.value) return !invalidStoredBusiness.value && Boolean(activeBusinessId.value)

    const storedId = localStorage.getItem(ACTIVE_BUSINESS_STORAGE_KEY)
    storageValidated.value = true

    if (!memberships.value.length) {
      activeBusinessId.value = null
      localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY)
      return false
    }

    if (!storedId) {
      activeBusinessId.value = memberships.value[0]?.business_id ?? null
      if (activeBusinessId.value) localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, activeBusinessId.value)
      return Boolean(activeBusinessId.value)
    }

    const { data, error } = await client
      .from('business')
      .select('id')
      .eq('id', storedId)
      .maybeSingle()

    if (error) throw error

    const membership = memberships.value.find(item => item.business_id === storedId)
    if (!data || !membership) {
      // El id guardado ya no sirve: el negocio se borró o alguien puso uno
      // ajeno. Como el usuario sí tiene membresías, se activa la primera en
      // vez de mandarlo a crear un negocio que ya tiene. El id ajeno nunca
      // llega a activarse, así que RLS sigue sin devolver datos de otro.
      const fallbackId = memberships.value[0]?.business_id ?? null
      activeBusinessId.value = fallbackId
      invalidStoredBusiness.value = !fallbackId

      if (fallbackId) localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, fallbackId)
      else localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY)

      return Boolean(fallbackId)
    }

    activeBusinessId.value = membership.business_id
    return true
  }

  function setActiveBusiness(businessId: string) {
    const membership = memberships.value.find(item => item.business_id === businessId)
    if (!membership) return false

    activeBusinessId.value = membership.business_id
    invalidStoredBusiness.value = false
    storageValidated.value = true
    if (import.meta.client) localStorage.setItem(ACTIVE_BUSINESS_STORAGE_KEY, membership.business_id)
    return true
  }

  function reset() {
    memberships.value = []
    activeBusinessId.value = null
    initialized.value = false
    storageValidated.value = false
    invalidStoredBusiness.value = false
    if (import.meta.client) localStorage.removeItem(ACTIVE_BUSINESS_STORAGE_KEY)
  }

  return {
    memberships,
    activeBusinessId,
    activeMembership,
    activeBusiness,
    initialized,
    invalidStoredBusiness,
    loadMemberships,
    validateStoredBusiness,
    setActiveBusiness,
    reset,
  }
})
