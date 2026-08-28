<script setup lang="ts">
import type { PaymentMethod } from '~/stores/cart'

type Option = { label: string; value: string }

defineProps<{ customers: Option[]; charging: boolean; quoting: boolean }>()
const emit = defineEmits<{ charge: []; quote: []; 'create-customer': [] }>()

const cart = useCartStore()
const { formatMoney } = useMoney()

const methods: Array<{ label: string; value: PaymentMethod }> = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Fiado', value: 'CREDIT' },
]

const isCredit = computed(() => cart.paymentMethod === 'CREDIT')
</script>

<template>
  <section class="grid gap-4 rounded-[10px] border border-black/10 bg-panel p-4">
    <h2 class="font-display text-[15px] font-bold tracking-[-.02em]">Cobro</h2>

    <div>
      <div class="mb-1.5 flex items-baseline justify-between gap-3">
        <label for="caja-customer" class="text-[11px] font-semibold text-ink">Cliente</label>
        <!-- Crear el cliente aquí mismo: descubrir que no existe no puede
             costar el carrito que se está cobrando. -->
        <button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-accent underline disabled:cursor-wait disabled:opacity-60 max-[760px]:min-h-11"
          :disabled="charging || quoting"
          data-testid="caja-new-customer"
          @click="emit('create-customer')"
        >
          + Nuevo cliente
        </button>
      </div>
      <PrimeSelect
        id="caja-customer"
        v-model="cart.customerId"
        :options="customers"
        option-label="label"
        option-value="value"
        placeholder="Sin cliente"
        show-clear
        filter
        filter-placeholder="Busca un cliente"
        :disabled="charging || quoting"
        fluid
      />
      <p v-if="!customers.length" class="mt-1.5 mb-0 text-[11px] text-muted">
        Este negocio todavía no tiene clientes. Crea el primero para poder fiar.
      </p>
    </div>

    <div>
      <span class="mb-1.5 block text-[11px] font-semibold text-ink">Método de pago</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="method in methods"
          :key="method.value"
          type="button"
          class="min-h-11 cursor-pointer rounded-[7px] border px-3 font-semibold transition-colors"
          :class="cart.paymentMethod === method.value
            ? 'border-ink bg-ink text-white'
            : 'border-black/15 bg-panel hover:bg-surface'"
          :aria-pressed="cart.paymentMethod === method.value"
          :disabled="charging || quoting"
          :data-testid="`method-${method.value}`"
          @click="cart.paymentMethod = method.value"
        >
          {{ method.label }}
        </button>
      </div>
    </div>

    <div v-if="isCredit">
      <label for="caja-due" class="mb-1.5 block text-[11px] font-semibold text-ink">Fecha de pago</label>
      <PrimeDatePicker id="caja-due" v-model="cart.dueDate" date-format="dd/mm/yy" show-icon :disabled="charging || quoting" fluid />
    </div>

    <div>
      <label for="caja-discount" class="mb-1.5 block text-[11px] font-semibold text-ink">Descuento</label>
      <PrimeInputNumber v-model="cart.discount" input-id="caja-discount" :min="0" :max-fraction-digits="0" :disabled="charging || quoting" fluid />
    </div>

    <dl class="m-0 grid gap-1.5 border-t border-black/10 pt-4 text-[12px]">
      <div class="flex justify-between gap-3">
        <dt class="text-muted">Subtotal</dt>
        <dd class="m-0 font-mono" data-testid="cart-subtotal">{{ formatMoney(cart.subtotal) }}</dd>
      </div>
      <div v-if="cart.discount" class="flex justify-between gap-3">
        <dt class="text-muted">Descuento</dt>
        <dd class="m-0 font-mono text-negative">{{ formatMoney(-cart.discount) }}</dd>
      </div>
      <div class="flex justify-between gap-3">
        <dt class="text-muted">Ganancia estimada</dt>
        <dd class="m-0 font-mono" :class="cart.estimatedProfit < 0 ? 'text-negative' : 'text-positive'" data-testid="cart-profit">
          {{ formatMoney(cart.estimatedProfit) }}
        </dd>
      </div>
    </dl>

    <div class="grid gap-1 rounded-[9px] bg-ink p-4 text-white max-[760px]:hidden">
      <span class="text-[9px] font-semibold tracking-[.09em] text-white/65 uppercase">Total a cobrar</span>
      <strong class="font-display text-[26px] leading-none tracking-[-.03em]" data-testid="cart-total">{{ formatMoney(cart.total) }}</strong>
    </div>

    <div class="grid gap-2">
      <UiButton class="w-full max-[760px]:hidden" :disabled="cart.isEmpty || quoting" :loading="charging" data-testid="caja-charge" @click="emit('charge')">
        Cobrar {{ formatMoney(cart.total) }}
      </UiButton>
      <UiButton class="w-full" variant="secondary" :disabled="cart.isEmpty || charging" :loading="quoting" data-testid="caja-save-quote" @click="emit('quote')">
        Guardar cotización
      </UiButton>
      <UiButton class="w-full" variant="ghost" :disabled="cart.isEmpty || charging || quoting" data-testid="caja-clear" @click="cart.clear()">
        Vaciar carrito
      </UiButton>
    </div>
  </section>
</template>
