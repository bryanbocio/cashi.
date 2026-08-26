<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}>(), { variant: 'primary', type: 'button', disabled: false, loading: false })

const severity = computed(() => ({ primary: 'primary', secondary: 'secondary', ghost: 'secondary', danger: 'danger' } as const)[props.variant])
</script>

<template>
  <PrimeButton :type="type" :severity="severity" :disabled="disabled" :loading="loading" :outlined="variant === 'secondary'" :text="variant === 'ghost'" class="min-h-10 font-semibold max-[760px]:min-h-11">
    <slot />
  </PrimeButton>
</template>
