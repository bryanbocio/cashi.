<script setup lang="ts">
export type DataTableColumn = { key: string; label: string; align?: 'left' | 'right'; mono?: boolean }
withDefaults(defineProps<{ columns: DataTableColumn[]; rows: Array<Record<string, unknown>>; rowKey?: string; emptyMessage?: string }>(), { rowKey: 'id', emptyMessage: 'No hay datos para mostrar.' })
</script>

<template>
  <PrimeDataTable :value="rows" :data-key="rowKey" striped-rows class="max-[759px]:hidden" table-style="min-width: 42rem">
    <template #empty><div class="py-8 text-center text-muted">{{ emptyMessage }}</div></template>
    <PrimeColumn v-for="column in columns" :key="column.key" :field="column.key" :header="column.label" :header-class="column.align === 'right' ? '!text-right' : ''" :body-class="[column.align === 'right' ? '!text-right' : '', column.mono ? '!font-mono' : '']">
      <template #body="{ data }"><slot :name="`cell-${column.key}`" :row="data" :value="data[column.key]">{{ data[column.key] }}</slot></template>
    </PrimeColumn>
  </PrimeDataTable>
</template>
