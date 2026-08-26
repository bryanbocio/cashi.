<script setup lang="ts">
import IconDownload from '~icons/lucide/download'
import IconFile from '~icons/lucide/file-spreadsheet'
import { CSV_TEMPLATE, MAX_IMPORT_BYTES } from '~/utils/inventory'

type ImportError = { row: number; sku: string; message: string }
type ImportResult = { created: number; updated: number; stock_ignored: number; errors: ImportError[] }

const emit = defineEmits<{ imported: [] }>()
const open = defineModel<boolean>('open', { default: false })

const client = useSupabaseClient()
const businessStore = useBusinessStore()
const { notifyError } = useSupabaseRequest()

const file = ref<File | null>(null)
const fileError = ref<string | null>(null)
const importing = ref(false)
const result = ref<ImportResult | null>(null)

watch(open, value => {
  if (value) return
  file.value = null
  fileError.value = null
  result.value = null
})

function chooseFile(event: Event) {
  fileError.value = null
  result.value = null
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  input.value = ''
  if (!selected) return

  if (selected.size > MAX_IMPORT_BYTES) {
    fileError.value = 'El archivo supera los 2 MiB. Divídelo en partes.'
    return
  }

  file.value = selected
}

function downloadTemplate() {
  // El BOM hace que Excel abra el archivo en UTF-8 y no rompa los acentos.
  const blob = new Blob([`﻿${CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-productos.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function submit() {
  const businessId = businessStore.activeBusinessId
  const selected = file.value
  if (!businessId || importing.value) return
  if (!selected) {
    fileError.value = 'Selecciona un archivo CSV.'
    return
  }

  importing.value = true
  fileError.value = null
  try {
    const csv = await selected.text()
    const { data, error } = await client.functions.invoke<ImportResult>('import-products', {
      body: { business_id: businessId, csv },
    })

    if (error) {
      // La función responde con un JSON explicando qué pasó; el mensaje del
      // error de red no dice nada útil por sí solo.
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
      fileError.value = detail?.message ?? 'No pudimos importar el archivo.'
      if (!detail?.message) notifyError(error)
      return
    }

    result.value = data ?? null
    if (data && (data.created || data.updated)) emit('imported')
  } catch (error) {
    fileError.value = 'No pudimos leer el archivo.'
    notifyError(error)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <UiModal v-model="open" title="Importar productos">
    <div class="grid gap-4">
      <p class="m-0 text-muted">
        Sube un CSV con las columnas <strong>SKU</strong> y <strong>Nombre</strong> como mínimo.
        Los productos se identifican por SKU: los nuevos se crean y los existentes se actualizan.
      </p>

      <button type="button" class="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-[7px] border-0 bg-transparent p-0 font-semibold text-accent underline" @click="downloadTemplate">
        <IconDownload class="size-4" aria-hidden="true" />Descargar plantilla
      </button>

      <div class="rounded-[9px] bg-surface p-4">
        <label class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[7px] border border-black/15 bg-panel px-3 font-semibold transition-colors hover:bg-white" :class="importing ? 'pointer-events-none opacity-50' : ''">
          <IconFile class="size-4" aria-hidden="true" />Seleccionar CSV
          <input class="sr-only" type="file" accept=".csv,text/csv" :disabled="importing" data-testid="import-file" @change="chooseFile" />
        </label>
        <p v-if="file" class="mt-2 truncate text-[11px] text-muted">{{ file.name }}</p>
        <p v-if="fileError" class="mt-2 text-[11px] text-negative" role="alert" data-testid="import-error">{{ fileError }}</p>
      </div>

      <section v-if="result" class="grid gap-3" data-testid="import-result">
        <div class="grid grid-cols-3 gap-2 text-center max-[480px]:grid-cols-1">
          <div class="rounded-[9px] border border-black/10 p-3">
            <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Creados</p>
            <strong class="font-display text-[18px]" data-testid="import-created">{{ result.created }}</strong>
          </div>
          <div class="rounded-[9px] border border-black/10 p-3">
            <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Actualizados</p>
            <strong class="font-display text-[18px]" data-testid="import-updated">{{ result.updated }}</strong>
          </div>
          <div class="rounded-[9px] border border-black/10 p-3">
            <p class="mb-1 text-[9px] font-semibold tracking-[.08em] text-subtle uppercase">Con error</p>
            <strong class="font-display text-[18px]" :class="result.errors.length ? 'text-negative' : ''" data-testid="import-errors-count">{{ result.errors.length }}</strong>
          </div>
        </div>

        <PrimeMessage v-if="result.stock_ignored" severity="info" :closable="false">
          Se ignoraron las existencias de {{ result.stock_ignored }}
          {{ result.stock_ignored === 1 ? 'producto que ya existía' : 'productos que ya existían' }}:
          el stock solo cambia con un ajuste registrado.
        </PrimeMessage>

        <div v-if="result.errors.length" class="max-h-56 overflow-y-auto rounded-[9px] border border-black/10">
          <table class="w-full border-collapse text-[11px]">
            <thead class="sticky top-0 bg-surface">
              <tr>
                <th class="p-2 text-left font-semibold">Fila</th>
                <th class="p-2 text-left font-semibold">SKU</th>
                <th class="p-2 text-left font-semibold">Problema</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="error in result.errors" :key="`${error.row}-${error.sku}`" class="border-t border-black/10">
                <td class="p-2 font-mono">{{ error.row }}</td>
                <td class="p-2 font-mono">{{ error.sku || '—' }}</td>
                <td class="p-2">{{ error.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="importing" @click="open = false">{{ result ? 'Cerrar' : 'Cancelar' }}</UiButton>
      <UiButton :disabled="!file" :loading="importing" data-testid="import-submit" @click="submit">Importar</UiButton>
    </template>
  </UiModal>
</template>
