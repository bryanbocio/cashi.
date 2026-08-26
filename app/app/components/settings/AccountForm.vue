<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(100, 'Usa 100 caracteres o menos.'),
  phone: z.string().trim().max(30, 'Usa 30 caracteres o menos.'),
})

const client = useSupabaseClient()
const { execute } = useSupabaseRequest()
const form = reactive({ fullName: '', phone: '' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const loading = ref(true)
const saving = ref(false)
const userId = ref<string | null>(null)
const email = ref('')

async function loadProfile() {
  loading.value = true
  try {
    const authData = await execute(client.auth.getUser())
    const user = authData.user
    if (!user) throw new Error('No encontramos la sesión de tu cuenta.')
    userId.value = user.id
    email.value = user.email ?? ''

    const profile = await execute(client
      .from('profile')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle())
    form.fullName = profile?.full_name ?? user.user_metadata?.full_name ?? ''
    form.phone = profile?.phone ?? ''
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    loading.value = false
  }
}

onMounted(loadProfile)

function validate() {
  Object.keys(errors).forEach(key => delete errors[key as keyof typeof errors])
  const result = schema.safeParse(form)
  if (result.success) return result.data

  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof typeof form
    if (field && !errors[field]) errors[field] = issue.message
  }
}

async function submit() {
  const values = validate()
  if (!values || !userId.value || saving.value) return

  saving.value = true
  try {
    await execute(client.from('profile').upsert({
      id: userId.value,
      full_name: values.fullName,
      phone: values.phone || null,
    }))
    await execute(client.auth.updateUser({
      data: { full_name: values.fullName, phone: values.phone || null },
    }), { successMessage: 'Los datos de tu cuenta fueron actualizados.' })
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <article class="rounded-[10px] border border-black/10 bg-panel p-6 max-[600px]:p-4">
    <header class="mb-5">
      <p class="mb-1 text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Cuenta personal</p>
      <h2 class="font-display text-xl font-bold tracking-[-.025em]">Tus datos</h2>
      <p class="mt-1 text-muted">Información asociada a tu usuario de Cashi.</p>
    </header>

    <div v-if="loading" class="grid gap-4">
      <PrimeSkeleton height="2.5rem" />
      <PrimeSkeleton height="2.5rem" />
      <PrimeSkeleton height="2.5rem" />
    </div>
    <form v-else class="grid gap-4" novalidate @submit.prevent="submit">
      <AuthField id="settings-account-name" v-model="form.fullName" label="Nombre completo" autocomplete="name" :error="errors.fullName" :disabled="saving" />
      <AuthField id="settings-account-phone" v-model="form.phone" label="Teléfono" autocomplete="tel" :error="errors.phone" :disabled="saving" />
      <AuthField id="settings-account-email" :model-value="email" label="Correo electrónico" type="email" autocomplete="email" disabled />
      <p class="-mt-2 text-[10.5px] text-muted">El correo de acceso no se cambia desde esta pantalla.</p>
      <div class="flex justify-end">
        <UiButton class="max-[680px]:w-full" type="submit" :loading="saving">Guardar cuenta</UiButton>
      </div>
    </form>
  </article>
</template>
