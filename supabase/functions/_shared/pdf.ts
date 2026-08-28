import { PDFDocument, PDFFont, PDFPage, degrees, rgb } from 'npm:pdf-lib@1.17.1'
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1'
import type { DocumentModel } from './document.ts'
import { paginateLines } from './document.ts'

/**
 * Plantilla única de factura y cotización.
 *
 * La composición sigue la del prototipo: encabezado del negocio a la izquierda,
 * identificación del documento a la derecha, tabla de líneas, totales alineados
 * a la derecha y nota al pie. Las tipografías del proyecto se embeben con
 * subsetting, así que solo viajan los glifos usados.
 */

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48
const INK = rgb(0.098, 0.094, 0.09)
const MUTED = rgb(0.42, 0.408, 0.392)
const LINE = rgb(0.85, 0.845, 0.835)
const ACCENT = rgb(0.121, 0.353, 1)

/** Cuántas líneas caben en cada página con la composición de arriba. */
const LINES_FIRST_PAGE = 18
const LINES_NEXT_PAGES = 30

export type DocumentFonts = { regular: Uint8Array; semibold: Uint8Array; mono: Uint8Array }

type Renderer = {
  page: PDFPage
  sans: PDFFont
  bold: PDFFont
  mono: PDFFont
}

/** Recorta con puntos suspensivos usando el ancho real del glifo, no un límite de caracteres. */
function ellipsize(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/** Parte un texto largo en las líneas que quepan a lo ancho indicado. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawRight(renderer: Renderer, text: string, font: PDFFont, size: number, right: number, y: number, color = INK) {
  renderer.page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color })
}

function drawBusinessHeader(renderer: Renderer, model: DocumentModel, logo: { width: number; height: number; draw: (x: number, y: number, width: number, height: number) => void } | null) {
  const { business } = model
  const top = A4[1] - MARGIN
  let y = top

  if (logo) {
    // El logo se encaja en un cuadro de 46 pt conservando su proporción.
    const scale = Math.min(46 / logo.width, 46 / logo.height)
    const width = logo.width * scale
    const height = logo.height * scale
    logo.draw(MARGIN, top - height, width, height)
    y = top - height - 10
  }

  renderer.page.drawText(business.name, { x: MARGIN, y: y - 14, size: 15, font: renderer.bold, color: INK })
  y -= 30

  const details = [business.nit ? `NIT ${business.nit}` : null, business.phone, business.address]
    .filter((value): value is string => Boolean(value && value.trim()))
  for (const detail of details) {
    renderer.page.drawText(ellipsize(detail, renderer.sans, 9, 240), { x: MARGIN, y, size: 9, font: renderer.sans, color: MUTED })
    y -= 12
  }

  return y
}

function drawDocumentIdentity(renderer: Renderer, model: DocumentModel) {
  const right = A4[0] - MARGIN
  const top = A4[1] - MARGIN
  drawRight(renderer, model.title.toUpperCase(), renderer.sans, 9, right, top - 10, MUTED)
  drawRight(renderer, model.code, renderer.bold, 20, right, top - 32, INK)

  let y = top - 52
  for (const item of model.meta) {
    drawRight(renderer, item.label.toUpperCase(), renderer.sans, 7.5, right, y, MUTED)
    drawRight(renderer, ellipsize(item.value, renderer.sans, 10, 220), renderer.sans, 10, right, y - 12, INK)
    y -= 26
  }
  return y
}

function drawTableHeader(renderer: Renderer, y: number) {
  const right = A4[0] - MARGIN
  renderer.page.drawLine({ start: { x: MARGIN, y: y + 14 }, end: { x: right, y: y + 14 }, thickness: 0.75, color: LINE })
  renderer.page.drawText('DESCRIPCIÓN', { x: MARGIN, y, size: 7.5, font: renderer.sans, color: MUTED })
  drawRight(renderer, 'CANT.', renderer.sans, 7.5, right - 210, y, MUTED)
  drawRight(renderer, 'PRECIO', renderer.sans, 7.5, right - 110, y, MUTED)
  drawRight(renderer, 'IMPORTE', renderer.sans, 7.5, right, y, MUTED)
  renderer.page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: right, y: y - 8 }, thickness: 0.75, color: LINE })
  return y - 24
}

function drawStamp(renderer: Renderer, stamp: string) {
  if (!stamp) return
  const size = 62
  const width = renderer.bold.widthOfTextAtSize(stamp, size)
  renderer.page.drawText(stamp, {
    x: (A4[0] - width * 0.72) / 2,
    y: A4[1] / 2 - 120,
    size,
    font: renderer.bold,
    color: rgb(0.76, 0.255, 0.047),
    opacity: 0.16,
    rotate: degrees(38),
  })
}

export async function renderDocument(
  model: DocumentModel,
  fonts: DocumentFonts,
  logoPng: Uint8Array | null,
  moneyOf: (line: DocumentModel['lines'][number]) => { unitPrice: string; lineTotal: string },
) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  // Sin `subset`: el subsetter de fontkit revienta dentro del runtime de Edge
  // Functions («value argument is out of bounds» al escribir la TTF nueva),
  // aunque funcione en Deno a secas. Las tres fuentes latinas pesan 116 kB y
  // el documento se queda muy por debajo del límite de 300 kB del plan.
  const sans = await pdf.embedFont(fonts.regular)
  const bold = await pdf.embedFont(fonts.semibold)
  const mono = await pdf.embedFont(fonts.mono)

  pdf.setTitle(`${model.title} ${model.code}`)
  pdf.setProducer('Cashi')
  pdf.setCreator('Cashi')

  const embeddedLogo = logoPng ? await pdf.embedPng(logoPng).catch(() => null) : null
  const pages = paginateLines(model.lines, LINES_FIRST_PAGE, LINES_NEXT_PAGES)
  const right = A4[0] - MARGIN

  for (const [index, pageLines] of pages.entries()) {
    const page = pdf.addPage(A4)
    const renderer: Renderer = { page, sans, bold, mono }
    let y: number

    if (index === 0) {
      const afterBusiness = drawBusinessHeader(renderer, model, embeddedLogo
        ? {
            width: embeddedLogo.width,
            height: embeddedLogo.height,
            draw: (x, logoY, width, height) => page.drawImage(embeddedLogo, { x, y: logoY, width, height }),
          }
        : null)
      const afterIdentity = drawDocumentIdentity(renderer, model)
      y = drawTableHeader(renderer, Math.min(afterBusiness, afterIdentity) - 26)
    } else {
      page.drawText(`${model.title} ${model.code}`, { x: MARGIN, y: A4[1] - MARGIN, size: 10, font: renderer.bold, color: MUTED })
      y = drawTableHeader(renderer, A4[1] - MARGIN - 34)
    }

    drawStamp(renderer, model.stamp)

    for (const line of pageLines) {
      const money = moneyOf(line)
      page.drawText(ellipsize(line.name, sans, 10, A4[0] - MARGIN * 2 - 250), { x: MARGIN, y, size: 10, font: sans, color: INK })
      drawRight(renderer, String(line.qty), mono, 10, right - 210, y)
      drawRight(renderer, money.unitPrice, mono, 10, right - 110, y)
      drawRight(renderer, money.lineTotal, mono, 10, right, y)
      y -= 18
    }

    if (!pageLines.length) {
      page.drawText('Este documento no tiene líneas.', { x: MARGIN, y, size: 10, font: sans, color: MUTED })
      y -= 18
    }

    // Totales y nota solo al final: el documento se lee de una vez.
    if (index === pages.length - 1) {
      y -= 6
      page.drawLine({ start: { x: right - 220, y }, end: { x: right, y }, thickness: 0.75, color: LINE })
      y -= 18

      for (const total of model.totals) {
        const font = total.emphasis ? bold : sans
        const size = total.emphasis ? 13 : 10
        page.drawText(total.label, { x: right - 220, y, size, font, color: total.emphasis ? INK : MUTED })
        drawRight(renderer, total.value, total.emphasis ? bold : mono, size, right, y, total.emphasis ? INK : INK)
        y -= total.emphasis ? 24 : 18
      }

      y -= 10
      for (const noteLine of wrap(model.note, sans, 9.5, A4[0] - MARGIN * 2)) {
        page.drawText(noteLine, { x: MARGIN, y, size: 9.5, font: sans, color: MUTED })
        y -= 13
      }
    }

    const footer = pages.length > 1 ? `Página ${index + 1} de ${pages.length}` : 'Generado con Cashi'
    page.drawText(footer, { x: MARGIN, y: MARGIN - 18, size: 8, font: sans, color: MUTED })
    drawRight(renderer, model.business.name, sans, 8, right, MARGIN - 18, ACCENT)
  }

  return await pdf.save()
}
