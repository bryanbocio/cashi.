<script setup lang="ts">
import type { Subscription } from '@supabase/supabase-js'
import { z } from 'zod'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Nueva contraseña · Cashi' })

const schema = z.object({
  password: z.string().min(8, 'Usa al menos 8 caracteres.'),
  confirmation: z.string().min(1, 'Confirma tu contraseña.'),
}).refine(values => values.password === values.confirmation, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmation'],
})

const client = useSupabaseClient()
const { execute } = useSupabaseRequest()
const form = reactive({ password: '', confirmation: '' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const checking = ref(true)
const ready = ref(false)
const loading = ref(false)
let authSubscription: Subscription | undefined

onMounted(async () => {
  const { data } = await client.auth.getSession()
  ready.value = Boolean(data.session)
  checking.value = false

  const listener = client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || session) ready.value = Boolean(session)
  })
  authSubscription = listener.data.subscription
})

onBeforeUnmount(() => authSubscription?.unsubscribe())

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
  if (!values || loading.value || !ready.value) return

  loading.value = true
  try {
    await execute(client.auth.updateUser({ password: values.password }), {
      errorTitle: 'No pudimos actualizar la contraseña',
    })
    await client.auth.signOut()
    await navigateTo('/login?recovered=1')
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthHeader title="Nueva contraseña" description="Elige una contraseña segura para volver a tu cuenta." />

  <PrimeMessage v-if="checking" severity="secondary" :closable="false">
    Validando el enlace seguro…
  </PrimeMessage>

  <template v-else-if="ready">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AuthField
        id="new-password"
        v-model="form.password"
        label="Nueva contraseña"
        type="password"
        autocomplete="new-password"
        placeholder="Mínimo 8 caracteres"
        :error="errors.password"
        :disabled="loading"
      />
      <AuthField
        id="new-password-confirmation"
        v-model="form.confirmation"
        label="Confirma la contraseña"
        type="password"
        autocomplete="new-password"
        placeholder="Repite tu contraseña"
        :error="errors.confirmation"
        :disabled="loading"
      />
      <UiButton class="w-full" type="submit" :loading="loading">Guardar contraseña</UiButton>
    </form>
  </template>

  <template v-else>
    <PrimeMessage severity="warn" :closable="false" class="mb-5">
      Este enlace no es válido o ya venció. Solicita uno nuevo para continuar.
    </PrimeMessage>
    <UiButton class="w-full" @click="navigateTo('/recuperar')">Solicitar otro enlace</UiButton>
  </template>
</template>
