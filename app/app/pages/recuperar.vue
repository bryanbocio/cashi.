<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Recuperar acceso · Cashi' })

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
})

const client = useSupabaseClient()
const { execute } = useSupabaseRequest()
const email = ref('')
const error = ref<string>()
const loading = ref(false)
const sent = ref(false)

async function submit() {
  error.value = undefined
  const result = schema.safeParse({ email: email.value })
  if (!result.success) {
    error.value = result.error.issues[0]?.message
    return
  }
  if (loading.value) return

  loading.value = true
  try {
    const redirectTo = new URL('/nueva-contrasena', window.location.origin).toString()
    await execute(client.auth.resetPasswordForEmail(result.data.email, { redirectTo }), {
      errorTitle: 'No pudimos enviar el enlace',
    })
    sent.value = true
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthHeader title="Recupera tu acceso" description="Te enviaremos un enlace seguro para restablecer la contraseña." />

  <PrimeMessage v-if="sent" severity="success" :closable="false" class="mb-5">
    Si existe una cuenta para <strong>{{ email }}</strong>, recibirás las instrucciones en unos minutos.
  </PrimeMessage>

  <form v-if="!sent" class="space-y-5" novalidate @submit.prevent="submit">
    <AuthField
      id="recovery-email"
      v-model="email"
      label="Correo electrónico"
      type="email"
      autocomplete="email"
      placeholder="tu@correo.com"
      :error="error"
      :disabled="loading"
    />
    <UiButton class="w-full" type="submit" :loading="loading">Enviar enlace</UiButton>
  </form>

  <UiButton v-else class="w-full" variant="secondary" @click="sent = false">Usar otro correo</UiButton>

  <p class="mt-6 text-center text-[12px] text-muted">
    <NuxtLink class="font-semibold text-accent hover:underline" to="/login">Volver a iniciar sesión</NuxtLink>
  </p>
</template>
