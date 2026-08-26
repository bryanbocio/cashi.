<script setup lang="ts">
const props = withDefaults(defineProps<{ tone?: 'neutral' | 'positive' | 'negative' | 'accent' }>(), { tone: 'neutral' })
const severity = computed(() => ({ neutral: 'secondary', positive: 'success', negative: 'danger', accent: 'info' } as const)[props.tone])
</script>

<template><PrimeTag :severity="severity" class="!text-[9.5px] !font-semibold !tracking-[.04em] !uppercase"><slot /></PrimeTag></template>
