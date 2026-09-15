<script setup lang="ts">
export type DataTableColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
  mono?: boolean
  /** Se oculta entre 760 y 1120 px, donde la sidebar deja poco ancho útil. */
  hideOnNarrow?: boolean
}
withDefaults(defineProps<{ columns: DataTableColumn[]; rows: Array<Record<string, unknown>>; rowKey?: string; emptyMessage?: string }>(), { rowKey: 'id', emptyMessage: 'No hay datos para mostrar.' })

function headerClass(column: DataTableColumn) {
  return [
    column.align === 'right' ? '!text-right [&_.p-datatable-column-header-content]:!justify-end' : '',
    column.mono ? '!font-mono' : '',
    column.hideOnNarrow ? 'max-[1120px]:!hidden' : '',
  ].filter(Boolean).join(' ')
}

function bodyClass(column: DataTableColumn) {
  return [
    column.align === 'right' ? '!text-right' : '',
    column.mono ? '!font-mono' : '',
    column.hideOnNarrow ? 'max-[1120px]:!hidden' : '',
  ].filter(Boolean).join(' ')
}
</script>

<template>
  <PrimeDataTable :value="rows" :data-key="rowKey" striped-rows class="max-[760px]:hidden" table-style="min-width: 100%">
    <template #empty><div class="py-8 text-center text-muted">{{ emptyMessage }}</div></template>
    <PrimeColumn v-for="column in columns" :key="column.key" :field="column.key" :header="column.label" :header-class="headerClass(column)" :body-class="bodyClass(column)">
      <template #body="{ data }"><slot :name="`cell-${column.key}`" :row="data" :value="data[column.key]">{{ data[column.key] }}</slot></template>
    </PrimeColumn>
  </PrimeDataTable>
</template>
