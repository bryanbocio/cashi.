<script setup lang="ts">
definePageMeta({ middleware: 'business' })
useHead({ title: 'Ajustes · Cashi' })
</script>

<template>
  <section class="mx-auto w-full max-w-360 px-8 pt-7 pb-12 max-[760px]:px-4 max-[760px]:pt-5 min-[760px]:max-[1120px]:px-6">
    <header class="mb-6.5">
      <p class="mb-2 text-[9.5px] font-semibold tracking-[.1em] text-subtle uppercase">Configuración</p>
      <h1 class="mb-1.5 font-display text-[clamp(24px,2.4vw,34px)] leading-[1.12] font-bold tracking-[-.03em]">Ajustes</h1>
      <p class="max-w-170 text-[13.5px] text-muted">Administra la información del negocio activo y los datos de tu cuenta.</p>
    </header>

    <div class="grid grid-cols-2 items-start gap-4 max-[980px]:grid-cols-1">
      <SettingsBusinessForm class="col-span-2 max-[980px]:col-span-1" />
      <SettingsAccountForm />
      <SettingsPasswordForm />
    </div>
  </section>
</template>
