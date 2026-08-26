<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(8, 'Usa al menos 8 caracteres.'),
  confirmation: z.string().min(1, 'Confirma tu nueva contraseña.'),
}).refine(values => values.password === values.confirmation, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmation'],
})

const client = useSupabaseClient()
const { execute } = useSupabaseRequest()
const form = reactive({ password: '', confirmation: '' })
const errors = reactive<Partial<Record<keyof typeof form, string>>>({})
const saving = ref(false)

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
  if (!values || saving.value) return

  saving.value = true
  try {
    await execute(client.auth.updateUser({ password: values.password }), {
      successMessage: 'Tu contraseña fue actualizada.',
    })
    form.password = ''
    form.confirmation = ''
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
      <p class="mb-1 text-[9px] font-semibold tracking-[.09em] text-subtle uppercase">Seguridad</p>
      <h2 class="font-display text-xl font-bold tracking-[-.025em]">Cambiar contraseña</h2>
      <p class="mt-1 text-muted">Usa una contraseña nueva de al menos 8 caracteres.</p>
    </header>

    <form class="grid gap-4" novalidate @submit.prevent="submit">
      <AuthField id="settings-password" v-model="form.password" label="Nueva contraseña" type="password" autocomplete="new-password" :error="errors.password" :disabled="saving" />
      <AuthField id="settings-password-confirmation" v-model="form.confirmation" label="Confirmar contraseña" type="password" autocomplete="new-password" :error="errors.confirmation" :disabled="saving" />
      <div class="flex justify-end">
        <UiButton class="max-[680px]:w-full" type="submit" :loading="saving">Actualizar contraseña</UiButton>
      </div>
    </form>
  </article>
</template>
