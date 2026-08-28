<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { Database } from '~/types/database'
import type { DocumentKind, DocumentView } from '~/utils/documents'
import {
  documentFileName,
  downloadDocumentPdf,
  exportNodeAsPng,
  loadLogoDataUrl,
  loadQuoteDocument,
  loadSaleDocument,
} from '~/utils/documents'

const props = defineProps<{ kind: DocumentKind | null; documentId: string | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ converted: []; voided: [] }>()

const client = useSupabaseClient<Database>()
const businessStore = useBusinessStore()
const toast = useToast()
const { execute } = useSupabaseRequest()
const { formatMoney } = useMoney()

const view = ref<DocumentView | null>(null)
const logo = ref<string | null>(null)
const loading = ref(false)
const downloading = ref(false)
const exporting = ref(false)
const converting = ref<'CASH' | 'CREDIT' | null>(null)
const voidOpen = ref(false)
const paper = ref<HTMLElement | null>(null)

const business = computed(() => businessStore.activeBusiness)
const timezone = computed(() => business.value?.timezone ?? 'America/Bogota')
const businessLine = computed(() => [
  business.value?.nit ? `NIT ${business.value.nit}` : null,
  business.value?.phone ? `Tel. ${business.value.phone}` : null,
  business.value?.address,
].filter(Boolean).join(' · '))

const busy = computed(() => downloading.value || exporting.value || Boolean(converting.value))

async function load() {
  if (!props.kind || !props.documentId) return
  loading.value = true
  view.value = null
  try {
    view.value = props.kind === 'SALE'
      ? await loadSaleDocument(client, props.documentId, timezone.value, business.value?.name ?? 'este negocio')
      : await loadQuoteDocument(client, props.documentId, timezone.value)
    if (!view.value) {
      toast.add({ severity: 'warn', summary: 'Documento no disponible', detail: 'No se encontró el documento en este negocio.', life: 4500 })
      open.value = false
    }
  } finally {
    loading.value = false
  }
}

watch(() => [open.value, props.documentId] as const, async ([isOpen]) => {
  if (!isOpen) return
  await load()
  logo.value = await loadLogoDataUrl(client, business.value?.logo_path)
}, { immediate: true })

// Escape cierra el visor esté donde esté el foco.
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
watch(open, (isOpen) => {
  if (import.meta.server) return
  if (isOpen) window.addEventListener('keydown', onKeyDown)
  else window.removeEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  if (!import.meta.server) window.removeEventListener('keydown', onKeyDown)
})

// El visor pertenece a la pantalla desde la que se abrió: cambiar de sección
// lo cierra, como pide el plan.
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })

function close() {
  if (busy.value) return
  open.value = false
}

async function downloadPdf() {
  if (!view.value || busy.value) return
  downloading.value = true
  try {
    await downloadDocumentPdf(client, view.value)
    toast.add({ severity: 'success', summary: 'PDF descargado', detail: documentFileName(view.value, 'pdf'), life: 4000 })
  } catch {
    toast.add({ severity: 'error', summary: 'No se pudo generar el PDF', detail: 'Vuelve a intentarlo en un momento.', life: 5000 })
  } finally {
    downloading.value = false
  }
}

async function downloadImage() {
  if (!view.value || !paper.value || busy.value) return
  exporting.value = true
  try {
    const fileName = documentFileName(view.value, 'png')
    const done = await exportNodeAsPng(paper.value, fileName)
    toast.add(done
      ? { severity: 'success', summary: 'Imagen descargada', detail: fileName, life: 4000 }
      : { severity: 'warn', summary: 'No se pudo generar la imagen', detail: 'Este navegador no la permite; descarga el PDF.', life: 5000 })
  } finally {
    exporting.value = false
  }
}

async function convert(method: 'CASH' | 'CREDIT') {
  if (!view.value || view.value.kind !== 'QUOTE' || !view.value.canConvert || busy.value) return
  converting.value = method
  try {
    const args = { p_quote: view.value.id, p_method: method, p_due: null } as unknown as Database['public']['Functions']['convert_quote']['Args']
    const sale = await execute(client.rpc('convert_quote', args)) as { code?: string; total?: number } | null
    toast.add({
      severity: 'success',
      summary: method === 'CREDIT' ? 'Cotización pasada a fiado' : 'Cotización cobrada',
      detail: `${view.value.code} se convirtió en ${sale?.code ?? 'una venta'} por ${formatMoney(sale?.total ?? view.value.total)}.`,
      life: 5000,
    })
    emit('converted')
    open.value = false
  } catch {
    // `useSupabaseRequest` ya tradujo el error del backend.
  } finally {
    converting.value = null
  }
}

/** Solo una venta confirmada se puede anular; la anulada ya lo está. */
const canVoid = computed(() => view.value?.kind === 'SALE' && view.value.status === 'CONFIRMED')

function afterVoid() {
  emit('voided')
  open.value = false
}

/** Un fiado sin cliente no se puede convertir: lo rechaza `create_sale`. */
const canConvertToCredit = computed(() => view.value?.canConvert && view.value.customerName !== 'Sin cliente')
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-ink/45 p-6 max-[760px]:p-3"
      data-testid="document-viewer"
      @click.self="close"
    >
      <div class="my-auto flex w-full max-w-155 flex-col gap-2.5" role="dialog" aria-modal="true" :aria-label="view?.title ?? 'Documento'" tabindex="-1">
        <div v-if="loading || !view" class="rounded-[10px] bg-panel p-7">
          <PrimeSkeleton width="11rem" height="1.25rem" class="mb-6" />
          <PrimeSkeleton v-for="line in 5" :key="line" height=".6875rem" class="mt-3.5" :width="`${96 - line * 8}%`" />
        </div>

        <!-- El papel se maqueta con estilos en línea a propósito: la exportación
             a PNG serializa este nodo dentro de un SVG, y ahí no llega ninguna
             hoja de estilos externa. Ver `exportNodeAsPng`. -->
        <div
          v-else
          ref="paper"
          data-testid="document-paper"
          style="position:relative;background:#ffffff;border:1px solid rgba(25,24,23,.14);border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:16px;box-shadow:0 12px 40px rgba(0,0,0,.2);font-family:'IBM Plex Sans',system-ui,sans-serif;color:#191817"
        >
          <div
            v-if="view.stamp"
            style="position:absolute;top:44%;left:0;right:0;text-align:center;font:700 54px 'Space Grotesk',system-ui,sans-serif;color:#c2410c;opacity:.16;transform:rotate(-24deg);pointer-events:none;letter-spacing:.04em"
            data-testid="document-stamp"
          >{{ view.stamp }}</div>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid rgba(25,24,23,.12);padding-bottom:14px">
            <div style="display:flex;gap:11px;align-items:flex-start;min-width:0">
              <img v-if="logo" :src="logo" alt="" style="width:44px;height:44px;object-fit:contain">
              <div style="min-width:0">
                <div style="font:700 20px 'Space Grotesk',system-ui,sans-serif">{{ business?.name ?? 'Negocio' }}</div>
                <div style="font:400 11.5px 'IBM Plex Sans',system-ui,sans-serif;color:#6b6864">{{ businessLine || 'Sin datos de contacto' }}</div>
              </div>
            </div>
            <div style="text-align:right;white-space:nowrap">
              <div style="font:600 13px 'Space Grotesk',system-ui,sans-serif">{{ view.title }}</div>
              <div style="font:500 12px 'IBM Plex Mono',ui-monospace,monospace;color:#6b6864" data-testid="document-code">{{ view.code }}</div>
              <div style="font:400 11.5px 'IBM Plex Sans',system-ui,sans-serif;color:#6b6864">{{ view.issuedLabel }}</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div>
              <div style="font:500 9.5px 'IBM Plex Mono',ui-monospace,monospace;color:#8c8880;text-transform:uppercase">Cliente</div>
              <div style="font:500 13.5px 'IBM Plex Sans',system-ui,sans-serif;margin-top:2px">{{ view.customerName }}</div>
              <div v-if="view.customerPhone" style="font:400 11.5px 'IBM Plex Sans',system-ui,sans-serif;color:#6b6864">{{ view.customerPhone }}</div>
            </div>
            <div v-if="view.detail" style="text-align:right">
              <div style="font:500 9.5px 'IBM Plex Mono',ui-monospace,monospace;color:#8c8880;text-transform:uppercase">{{ view.detail.label }}</div>
              <div style="font:500 13.5px 'IBM Plex Sans',system-ui,sans-serif;margin-top:2px">{{ view.detail.value }}</div>
            </div>
          </div>

          <div>
            <div style="display:grid;grid-template-columns:minmax(0,1fr) 48px 96px 104px;padding:6px 0;border-bottom:1px solid rgba(25,24,23,.12);font:500 9.5px 'IBM Plex Mono',ui-monospace,monospace;color:#8c8880;text-transform:uppercase">
              <span>Descripción</span><span style="text-align:center">Cant</span><span style="text-align:right">Precio</span><span style="text-align:right">Total</span>
            </div>
            <div
              v-for="line in view.lines"
              :key="line.id"
              style="display:grid;grid-template-columns:minmax(0,1fr) 48px 96px 104px;padding:8px 0;border-bottom:1px solid rgba(25,24,23,.06);font:400 12.5px 'IBM Plex Sans',system-ui,sans-serif"
            >
              <span>{{ line.name }}</span>
              <span style="text-align:center;font-family:'IBM Plex Mono',ui-monospace,monospace">{{ line.qty }}</span>
              <span style="text-align:right;font-family:'IBM Plex Mono',ui-monospace,monospace">{{ formatMoney(line.unitPrice) }}</span>
              <span style="text-align:right;font-family:'IBM Plex Mono',ui-monospace,monospace">{{ formatMoney(line.lineTotal) }}</span>
            </div>
            <div v-if="!view.lines.length" style="padding:14px 0;font:400 12.5px 'IBM Plex Sans',system-ui,sans-serif;color:#8c8880">Este documento no tiene líneas.</div>
          </div>

          <div style="display:flex;justify-content:flex-end">
            <div style="min-width:220px;display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;font:400 12.5px 'IBM Plex Sans',system-ui,sans-serif;color:#4a4741">
                <span>Subtotal</span><span style="font-family:'IBM Plex Mono',ui-monospace,monospace">{{ formatMoney(view.subtotal) }}</span>
              </div>
              <div v-if="view.discount > 0" style="display:flex;justify-content:space-between;font:400 12.5px 'IBM Plex Sans',system-ui,sans-serif;color:#c2410c">
                <span>Descuento</span><span style="font-family:'IBM Plex Mono',ui-monospace,monospace">{{ formatMoney(-view.discount) }}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid rgba(25,24,23,.12);padding-top:8px">
                <span style="font:600 13px 'Space Grotesk',system-ui,sans-serif">Total</span>
                <span style="font:700 22px 'Space Grotesk',system-ui,sans-serif" data-testid="document-total">{{ formatMoney(view.total) }}</span>
              </div>
            </div>
          </div>

          <div style="font:400 11px/1.6 'IBM Plex Sans',system-ui,sans-serif;color:#8c8880;border-top:1px solid rgba(25,24,23,.08);padding-top:12px" data-testid="document-note">{{ view.note }}</div>
        </div>

        <div class="flex flex-wrap justify-center gap-2 pb-3">
          <UiButton :disabled="!view || busy" :loading="downloading" data-testid="document-pdf" @click="downloadPdf">Descargar PDF</UiButton>
          <UiButton variant="secondary" :disabled="!view || busy" :loading="exporting" data-testid="document-image" @click="downloadImage">Descargar imagen</UiButton>
          <template v-if="view?.canConvert">
            <UiButton variant="secondary" :disabled="busy" :loading="converting === 'CASH'" data-testid="document-to-sale" @click="convert('CASH')">Convertir en venta</UiButton>
            <UiButton variant="secondary" :disabled="busy || !canConvertToCredit" :loading="converting === 'CREDIT'" data-testid="document-to-credit" @click="convert('CREDIT')">Convertir en fiado</UiButton>
          </template>
          <UiButton v-if="canVoid" variant="danger" :disabled="busy" data-testid="document-void" @click="voidOpen = true">Anular venta</UiButton>
          <UiButton variant="ghost" class="!text-white" :disabled="busy" data-testid="document-close" @click="close">Cerrar</UiButton>
        </div>

        <DocumentsVoidSaleModal
          v-model:open="voidOpen"
          :code="view?.code ?? null"
          :sale-id="view?.id ?? null"
          :total="view?.total ?? 0"
          @voided="afterVoid"
        />
      </div>
    </div>
  </Teleport>
</template>
