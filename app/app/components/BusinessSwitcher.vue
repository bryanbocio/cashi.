<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconChevron from '~icons/lucide/chevrons-up-down'
import IconLogOut from '~icons/lucide/log-out'
import IconPlus from '~icons/lucide/plus'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const emit = defineEmits<{ action: [] }>()

const client = useSupabaseClient()
const businessStore = useBusinessStore()
const { notifyError } = useSupabaseRequest()
const popover = ref<{ hide: () => void; toggle: (event: Event) => void } | null>(null)
const open = ref(false)
const busy = ref(false)

const activeName = computed(() => businessStore.activeBusiness?.name ?? 'Sin negocio activo')
const activeRole = computed(() => roleLabel(businessStore.activeMembership?.role))

function roleLabel(role?: string) {
  if (!role) return 'Sin selección'
  return {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    CASHIER: 'Cajero',
  }[role] ?? role
}

function initials(name?: string | null) {
  const parts = name?.split(/\s+/).filter(Boolean) ?? []
  if (!parts.length) return '—'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function toggle(event: Event) {
  popover.value?.toggle(event)
}

function close() {
  popover.value?.hide()
  emit('action')
}

async function selectBusiness(businessId: string) {
  if (busy.value) return

  if (!businessStore.setActiveBusiness(businessId)) {
    notifyError(new Error('El negocio seleccionado no pertenece a tu cuenta.'), {
      errorTitle: 'No pudimos cambiar de negocio',
    })
    return
  }

  clearNuxtData()
  close()
  await navigateTo('/')
}

async function signOut() {
  if (busy.value) return

  busy.value = true
  try {
    const { error } = await client.auth.signOut()
    if (error) throw error

    clearNuxtData()
    businessStore.reset()
    close()
    await navigateTo('/login')
  } catch (error) {
    notifyError(error, { errorTitle: 'No pudimos cerrar la sesión' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="compact"
    class="relative grid size-11 cursor-pointer place-items-center rounded-[7px] border border-black/10 bg-panel font-display text-[11px] font-bold"
    type="button"
    :aria-label="`Cambiar negocio. Activo: ${activeName}`"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @click="toggle"
  >
    <span>{{ initials(activeName) }}</span>
    <IconChevron class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full bg-surface p-0.5" aria-hidden="true" />
  </button>

  <button
    v-else
    class="grid min-h-12 w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_16px] items-center gap-2 rounded-[7px] border-0 bg-surface p-[7px] text-left transition-colors hover:bg-white"
    type="button"
    :aria-label="`Cambiar negocio. Activo: ${activeName}`"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @click="toggle"
  >
    <span class="grid size-8 place-items-center rounded-[7px] bg-ink font-display text-[11px] font-bold text-white">{{ initials(activeName) }}</span>
    <span class="grid min-w-0">
      <strong class="truncate text-[11.5px]">{{ activeName }}</strong>
      <small class="truncate text-[9.5px] text-muted">{{ activeRole }}</small>
    </span>
    <IconChevron class="size-3.5" aria-hidden="true" />
  </button>

  <PrimePopover ref="popover" class="w-[min(290px,calc(100vw-24px))]" @show="open = true" @hide="open = false">
    <div class="p-1" data-testid="business-switcher-menu">
      <p class="px-2 pb-2 text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Tus negocios</p>
      <div class="grid gap-1">
        <button
          v-for="membership in businessStore.memberships"
          :key="membership.id"
          class="grid min-h-12 w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_18px] items-center gap-2 rounded-[7px] border-0 px-2 py-1.5 text-left transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
          :class="membership.business_id === businessStore.activeBusinessId ? 'bg-surface' : 'bg-transparent'"
          type="button"
          :disabled="busy"
          :aria-label="`Cambiar a ${membership.business?.name ?? 'negocio sin nombre'}`"
          :aria-current="membership.business_id === businessStore.activeBusinessId ? 'true' : undefined"
          @click="selectBusiness(membership.business_id)"
        >
          <span class="grid size-8 place-items-center rounded-[7px] bg-ink font-display text-[10px] font-bold text-white">{{ initials(membership.business?.name) }}</span>
          <span class="grid min-w-0">
            <strong class="truncate text-[11.5px]">{{ membership.business?.name ?? 'Negocio sin nombre' }}</strong>
            <small class="truncate text-[9.5px] text-muted">{{ roleLabel(membership.role) }}</small>
          </span>
          <IconCheck v-if="membership.business_id === businessStore.activeBusinessId" class="size-4 text-accent" aria-hidden="true" />
        </button>
      </div>

      <div class="my-2 border-t border-black/10" />
      <NuxtLink class="flex min-h-10 items-center gap-2 rounded-[7px] px-2 font-semibold text-accent transition-colors hover:bg-surface" to="/onboarding" @click="close">
        <IconPlus class="size-4" aria-hidden="true" />Crear otro negocio
      </NuxtLink>
      <button class="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent px-2 text-left font-medium text-muted transition-colors hover:bg-surface hover:text-negative disabled:cursor-wait disabled:opacity-60" type="button" :disabled="busy" @click="signOut">
        <IconLogOut class="size-4" aria-hidden="true" />Cerrar sesión
      </button>
    </div>
  </PrimePopover>
</template>
