<script setup lang="ts">
const model = defineModel<string>({ required: true })

withDefaults(defineProps<{
  id: string
  label: string
  type?: 'email' | 'password' | 'text'
  autocomplete?: string
  placeholder?: string
  error?: string
  disabled?: boolean
}>(), {
  type: 'text',
  autocomplete: undefined,
  placeholder: undefined,
  error: undefined,
  disabled: false,
})
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-[11px] font-semibold text-ink">
      {{ label }}
    </label>
    <PrimeInputText
      :id="id"
      v-model="model"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :invalid="Boolean(error)"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${id}-error` : undefined"
      fluid
    />
    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-[11px] text-negative" role="alert">
      {{ error }}
    </p>
  </div>
</template>
