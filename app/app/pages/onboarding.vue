<script setup lang="ts">
definePageMeta({ layout: 'auth' })
</script>

<template>
  <AuthHeader title="Crea tu negocio" description="Configura nombre, moneda y zona horaria para comenzar." />
  <PrimeInputText disabled fluid placeholder="Formulario disponible en F1.3" class="mb-3.5" />
  <UiButton class="w-full" disabled>Crear negocio</UiButton>
</template>
