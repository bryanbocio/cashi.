<script setup lang="ts">defineProps<{ title: string; description: string; action: string }>()</script>

<template>
  <div>
    <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Cuenta Cashi</p>
    <h1 class="mb-2 font-display text-[26px] font-bold tracking-[-.035em]">{{ title }}</h1>
    <p class="mb-5.5 text-[13px] text-muted">{{ description }}</p>
    <PrimeInputText disabled fluid placeholder="Formulario disponible en F1.1" class="mb-3.5" />
    <UiButton class="w-full" disabled>{{ action }}</UiButton>
  </div>
</template>
