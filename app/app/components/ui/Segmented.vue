<script setup lang="ts">
type Option = { label: string; value: string }
const model = defineModel<string>({ required: true })
defineProps<{ options: Option[]; label?: string }>()
</script>

<template>
  <div>
    <span v-if="label" class="sr-only">{{ label }}</span>
    <PrimeSelectButton v-model="model" :options="options" option-label="label" option-value="value" :allow-empty="false" aria-labelledby="label" class="min-h-10 max-[760px]:min-h-11" />
  </div>
</template>
