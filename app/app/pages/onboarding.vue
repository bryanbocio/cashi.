<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const invalidBusiness = computed(() => route.query.reason === 'invalid-business')
</script>

<template>
  <AuthHeader title="Crea tu negocio" description="Configura nombre, moneda y zona horaria para comenzar." />
  <PrimeMessage v-if="invalidBusiness" severity="warn" :closable="false" class="mb-5">
    El negocio guardado no pertenece a tu cuenta. Selecciona o crea un negocio para continuar.
  </PrimeMessage>
  <PrimeInputText disabled fluid placeholder="Formulario disponible en F1.3" class="mb-3.5" />
  <UiButton class="w-full" disabled>Crear negocio</UiButton>
</template>
