<script setup lang="ts">
import IconMinus from '~icons/lucide/minus'
import IconPlus from '~icons/lucide/plus'
import IconTrash from '~icons/lucide/trash-2'
import type { CartItem } from '~/stores/cart'

defineProps<{ items: CartItem[] }>()
const emit = defineEmits<{ increment: [string]; decrement: [string]; remove: [string] }>()

const { formatMoney, formatNumber, formatPercent } = useMoney()

function marginPct(item: CartItem) {
  if (item.price <= 0) return null
  return Math.round(((item.price - item.cost) * 100 / item.price) * 10) / 10
}
</script>

<template>
  <section class="rounded-[10px] border border-black/10 bg-panel">
    <header class="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
      <h2 class="font-display text-[15px] font-bold tracking-[-.02em]">Carrito</h2>
      <span class="text-[11px] text-muted" data-testid="cart-count">
        {{ items.length }} {{ items.length === 1 ? 'producto' : 'productos' }}
      </span>
    </header>

    <p v-if="!items.length" class="m-0 px-4 py-8 text-center text-muted" data-testid="cart-empty">
      El carrito está vacío.
    </p>

    <ul v-else class="m-0 list-none p-0">
      <li v-for="item in items" :key="item.id" class="border-b border-black/10 px-4 py-3 last:border-b-0" :data-testid="`cart-${item.sku}`">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <strong class="block truncate font-semibold">{{ item.name }}</strong>
            <span class="font-mono text-[10.5px] text-subtle">{{ item.sku }}</span>
          </div>
          <button
            type="button"
            class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent text-subtle transition-colors hover:bg-surface hover:text-negative max-[760px]:size-11"
            :aria-label="`Quitar ${item.name}`"
            :data-testid="`cart-remove-${item.sku}`"
            @click="emit('remove', item.id)"
          >
            <IconTrash class="size-4" aria-hidden="true" />
          </button>
        </div>

        <div class="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="grid size-8 cursor-pointer place-items-center rounded-[7px] border border-black/15 bg-panel transition-colors hover:bg-surface max-[760px]:size-11"
              :aria-label="`Quitar una unidad de ${item.name}`"
              :data-testid="`cart-minus-${item.sku}`"
              @click="emit('decrement', item.id)"
            >
              <IconMinus class="size-3.5" aria-hidden="true" />
            </button>
            <span class="min-w-8 text-center font-mono text-[13px] font-semibold" :data-testid="`cart-qty-${item.sku}`">{{ item.qty }}</span>
            <button
              type="button"
              class="grid size-8 cursor-pointer place-items-center rounded-[7px] border border-black/15 bg-panel transition-colors hover:bg-surface max-[760px]:size-11"
              :aria-label="`Agregar una unidad de ${item.name}`"
              :data-testid="`cart-plus-${item.sku}`"
              @click="emit('increment', item.id)"
            >
              <IconPlus class="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <div class="text-right">
            <strong class="block font-mono text-[13px]">{{ formatMoney(item.qty * item.price) }}</strong>
            <span class="text-[10.5px] text-muted">
              Margen {{ formatPercent(marginPct(item)) }} ·
              {{ formatMoney(item.qty * (item.price - item.cost)) }}
            </span>
          </div>
        </div>

        <p v-if="item.qty > item.stock" class="mt-2 mb-0 text-[10.5px] font-semibold text-negative" role="status">
          Solo hay {{ formatNumber(item.stock) }} en stock; la venta seguirá y el inventario quedará en negativo.
        </p>
      </li>
    </ul>
  </section>
</template>
