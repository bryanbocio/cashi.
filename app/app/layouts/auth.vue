<template>
  <main class="grid min-h-screen place-content-center bg-[radial-gradient(circle_at_20%_10%,rgba(31,90,255,.08),transparent_26rem)] bg-paper px-4 py-10">
    <NuxtLink class="mx-auto mb-6 font-display text-[28px] font-bold tracking-[-.05em]" to="/login" aria-label="Cashi, inicio de sesión">cashi<span class="text-accent">.</span></NuxtLink>
    <section class="w-[min(calc(100vw-32px),420px)] rounded-xl border border-black/10 bg-panel p-8 shadow-[var(--shadow-raised)] max-[480px]:p-5"><slot /></section>
    <p class="mt-5 text-center text-subtle">Inventario, ventas y ganancias en un solo lugar.</p>
  </main>
</template>
