<script setup lang="ts">
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import type { MetricsPeriod } from '~/utils/metrics'
import { METRICS_MONTH_OPTIONS, METRICS_PERIODS, monthOffsetOptions } from '~/utils/metrics'

const props = defineProps<{ timezone: string; label: string; comparisonLabel: string }>()

const period = defineModel<MetricsPeriod>('period', { required: true })
const monthOffset = defineModel<number>('monthOffset', { required: true })

const months = computed(() => monthOffsetOptions(props.timezone))
const isMonth = computed(() => period.value === 'month')

/** El mes más antiguo navegable; más atrás no hay opción en el selector. */
const oldestOffset = METRICS_MONTH_OPTIONS - 1

/** Navegar por meses implica estar en el periodo mensual, como en el prototipo. */
function goToMonth(offset: number) {
  monthOffset.value = Math.min(Math.max(offset, 0), oldestOffset)
  period.value = 'month'
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="dashboard-period">
    <div class="flex max-[760px]:w-full" role="group" aria-label="Periodo">
      <button
        v-for="option in METRICS_PERIODS"
        :key="option.value"
        type="button"
        class="cursor-pointer border border-black/14 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors first:rounded-l-[7px] last:rounded-r-[7px] not-first:border-l-0 max-[760px]:min-h-11 max-[760px]:flex-1 max-[760px]:text-center"
        :class="period === option.value ? 'border-ink bg-ink text-paper' : 'bg-panel text-ink hover:bg-surface'"
        :aria-pressed="period === option.value"
        :data-testid="`period-${option.value}`"
        @click="period = option.value"
      >
        <span class="max-[760px]:hidden">{{ option.label }}</span>
        <span class="hidden max-[760px]:inline">{{ option.shortLabel }}</span>
      </button>
    </div>

    <!-- Las flechas y el selector de mes solo tienen sentido en el periodo mensual. -->
    <div v-if="isMonth" class="flex items-center gap-1.5 max-[760px]:w-full" data-testid="month-nav">
      <button
        type="button"
        class="grid size-8 cursor-pointer place-items-center rounded-[7px] border border-black/14 bg-panel text-ink transition-colors hover:bg-surface max-[760px]:size-11"
        :disabled="monthOffset >= oldestOffset"
        :class="monthOffset >= oldestOffset ? 'cursor-default opacity-35' : ''"
        aria-label="Mes anterior"
        data-testid="month-prev"
        @click="goToMonth(monthOffset + 1)"
      >
        <IconChevronLeft class="size-4" aria-hidden="true" />
      </button>

      <PrimeSelect
        :model-value="monthOffset"
        :options="months"
        option-label="label"
        option-value="value"
        aria-label="Mes"
        class="min-w-38 capitalize max-[760px]:flex-1"
        data-testid="month-select"
        @update:model-value="goToMonth($event)"
      />

      <button
        type="button"
        class="grid size-8 cursor-pointer place-items-center rounded-[7px] border border-black/14 bg-panel text-ink transition-colors hover:bg-surface max-[760px]:size-11"
        :disabled="monthOffset === 0"
        :class="monthOffset === 0 ? 'cursor-default opacity-35' : ''"
        aria-label="Mes siguiente"
        data-testid="month-next"
        @click="goToMonth(monthOffset - 1)"
      >
        <IconChevronRight class="size-4" aria-hidden="true" />
      </button>
    </div>

    <p class="m-0 ml-auto text-[11.5px] text-muted max-[760px]:hidden" data-testid="period-note">
      <strong class="font-medium text-ink capitalize" data-testid="period-label">{{ label || 'Periodo actual' }}</strong>
      <span v-if="comparisonLabel"> · Comparado con {{ comparisonLabel }}</span>
    </p>
  </div>
</template>
