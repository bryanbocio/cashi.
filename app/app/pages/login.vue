<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Iniciar sesión · Cashi' })

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

const client = useSupabaseClient()
const route = useRoute()
const { execute } = useSupabaseRequest()
const form = reactive({ email: '', password: '' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const loading = ref(false)

function redirectAfterLogin() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
}

const notice = computed(() => {
  if (route.query.expired === '1') {
    return { severity: 'warn' as const, text: 'Tu sesión venció por seguridad. Vuelve a entrar para seguir donde ibas.' }
  }
  if (route.query.confirmed === '1') return { severity: 'success' as const, text: 'Tu correo fue confirmado. Ya puedes iniciar sesión.' }
  if (route.query.recovered === '1') return { severity: 'success' as const, text: 'Tu contraseña fue actualizada. Inicia sesión nuevamente.' }
  return null
})

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
  if (!values || loading.value) return

  loading.value = true
  try {
    await execute(client.auth.signInWithPassword(values), {
      errorTitle: 'No pudimos iniciar sesión',
    })
    await navigateTo(redirectAfterLogin())
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthHeader title="Inicia sesión" description="Accede a tus negocios y continúa donde lo dejaste." />

  <PrimeMessage v-if="notice" :severity="notice.severity" :closable="false" class="mb-5" data-testid="login-notice">
    {{ notice.text }}
  </PrimeMessage>

  <form class="space-y-4" novalidate @submit.prevent="submit">
    <AuthField
      id="login-email"
      v-model="form.email"
      label="Correo electrónico"
      type="email"
      autocomplete="email"
      placeholder="tu@correo.com"
      :error="errors.email"
      :disabled="loading"
    />
    <AuthField
      id="login-password"
      v-model="form.password"
      label="Contraseña"
      type="password"
      autocomplete="current-password"
      placeholder="Tu contraseña"
      :error="errors.password"
      :disabled="loading"
    />

    <div class="flex justify-end">
      <NuxtLink class="text-[11px] font-semibold text-accent hover:underline" to="/recuperar">
        ¿Olvidaste tu contraseña?
      </NuxtLink>
    </div>

    <UiButton class="w-full" type="submit" :loading="loading">Ingresar</UiButton>
  </form>

  <p class="mt-6 text-center text-[12px] text-muted">
    ¿Aún no tienes cuenta?
    <NuxtLink class="font-semibold text-accent hover:underline" to="/registro">Créala gratis</NuxtLink>
  </p>
</template>
