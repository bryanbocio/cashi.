<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Crear cuenta · Cashi' })

const schema = z.object({
  fullName: z.string().trim().min(2, 'Escribe tu nombre completo.'),
  email: z.string().trim().min(1, 'Escribe tu correo.').email('Escribe un correo válido.'),
  password: z.string().min(8, 'Usa al menos 8 caracteres.'),
  confirmation: z.string().min(1, 'Confirma tu contraseña.'),
}).refine(values => values.password === values.confirmation, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmation'],
})

const client = useSupabaseClient()
const { execute } = useSupabaseRequest()
const form = reactive({ fullName: '', email: '', password: '', confirmation: '' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const loading = ref(false)
const sentTo = ref<string | null>(null)

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
    const redirectTo = new URL('/login?confirmed=1', window.location.origin).toString()
    const data = await execute(client.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: values.fullName },
      },
    }), { errorTitle: 'No pudimos crear tu cuenta' })

    if (data?.session) {
      await navigateTo('/onboarding')
    } else {
      sentTo.value = values.email
    }
  } catch {
    // El wrapper ya presentó el error traducido.
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <template v-if="sentTo">
    <AuthHeader title="Revisa tu correo" description="Te enviamos un enlace para confirmar tu cuenta." />
    <PrimeMessage severity="success" :closable="false" class="mb-5">
      Abre el mensaje enviado a <strong>{{ sentTo }}</strong> y confirma tu correo antes de ingresar.
    </PrimeMessage>
    <UiButton class="w-full" variant="secondary" @click="navigateTo('/login')">Ir a iniciar sesión</UiButton>
  </template>

  <template v-else>
    <AuthHeader title="Crea tu cuenta" description="Empieza a organizar inventario y ganancias de forma sencilla." />
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AuthField
        id="register-name"
        v-model="form.fullName"
        label="Nombre completo"
        autocomplete="name"
        placeholder="Tu nombre"
        :error="errors.fullName"
        :disabled="loading"
      />
      <AuthField
        id="register-email"
        v-model="form.email"
        label="Correo electrónico"
        type="email"
        autocomplete="email"
        placeholder="tu@correo.com"
        :error="errors.email"
        :disabled="loading"
      />
      <AuthField
        id="register-password"
        v-model="form.password"
        label="Contraseña"
        type="password"
        autocomplete="new-password"
        placeholder="Mínimo 8 caracteres"
        :error="errors.password"
        :disabled="loading"
      />
      <AuthField
        id="register-confirmation"
        v-model="form.confirmation"
        label="Confirma la contraseña"
        type="password"
        autocomplete="new-password"
        placeholder="Repite tu contraseña"
        :error="errors.confirmation"
        :disabled="loading"
      />

      <UiButton class="w-full" type="submit" :loading="loading">Crear cuenta</UiButton>
    </form>

    <p class="mt-6 text-center text-[12px] text-muted">
      ¿Ya tienes cuenta?
      <NuxtLink class="font-semibold text-accent hover:underline" to="/login">Inicia sesión</NuxtLink>
    </p>
  </template>
</template>
