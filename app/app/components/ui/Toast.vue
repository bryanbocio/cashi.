<script setup lang="ts">
const props = withDefaults(defineProps<{ message: string; tone?: 'info' | 'success' | 'error' }>(), { tone: 'info' })
const severity = computed(() => ({ info: 'info', success: 'success', error: 'error' } as const)[props.tone])
</script>

<template><PrimeMessage :severity="severity" :closable="false" class="w-[min(380px,calc(100vw-32px))] shadow-[var(--shadow-raised)]">{{ message }}</PrimeMessage></template>
