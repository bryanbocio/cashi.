/**
 * Genera `index.ts`, las tipografías que embebe `document-pdf`.
 *
 * Dos obstáculos justifican este paso:
 *
 * 1. `@pdf-lib/fontkit` no descomprime WOFF —al intentarlo lee fuera del búfer
 *    del `glyf`—, así que hay que deshacer el contenedor WOFF de `@fontsource`
 *    y reconstruir la TTF original. WOFF es sencillo: cada tabla sfnt
 *    comprimida con zlib.
 * 2. El runtime de Edge Functions solo empaqueta los módulos que se importan;
 *    un `.ttf` junto a la función no llega al worker. Por eso las fuentes
 *    viajan como base64 dentro de un módulo TypeScript.
 *
 * Regenerar: `node supabase/functions/_shared/fonts/build-fonts.cjs`, con las
 * dependencias del frontend instaladas.
 *
 * IBM Plex se distribuye bajo SIL Open Font License 1.1; la licencia viaja en
 * `LICENSE.txt`, en este mismo directorio, como exige la OFL.
 */
const { inflateSync } = require('node:zlib')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const source = join(__dirname, '..', '..', '..', '..', 'app', 'node_modules', '@fontsource')
const FONTS = [
  ['ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff', 'REGULAR'],
  ['ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff', 'SEMIBOLD'],
  ['ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff', 'MONO'],
]

function woffToTtf(woff) {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('El archivo no es WOFF.')

  const flavor = woff.readUInt32BE(4)
  const numTables = woff.readUInt16BE(12)

  const tables = []
  for (let index = 0; index < numTables; index += 1) {
    const entry = 44 + index * 20
    const compLength = woff.readUInt32BE(entry + 8)
    const origLength = woff.readUInt32BE(entry + 12)
    const offset = woff.readUInt32BE(entry + 4)
    const raw = woff.subarray(offset, offset + compLength)
    tables.push({
      tag: woff.toString('ascii', entry, entry + 4),
      checksum: woff.readUInt32BE(entry + 16),
      // Una tabla se guarda sin comprimir cuando comprimirla no la reducía.
      data: compLength < origLength ? inflateSync(raw) : raw.subarray(0, origLength),
    })
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1))

  // Cabecera sfnt: los tres campos derivados de numTables los define la spec.
  const entrySelector = Math.floor(Math.log2(numTables))
  const searchRange = 2 ** entrySelector * 16
  const header = Buffer.alloc(12)
  header.writeUInt32BE(flavor, 0)
  header.writeUInt16BE(numTables, 4)
  header.writeUInt16BE(searchRange, 6)
  header.writeUInt16BE(entrySelector, 8)
  header.writeUInt16BE(numTables * 16 - searchRange, 10)

  const directory = Buffer.alloc(numTables * 16)
  const chunks = []
  let offset = 12 + directory.length

  tables.forEach((table, index) => {
    const entry = index * 16
    directory.write(table.tag, entry, 4, 'ascii')
    directory.writeUInt32BE(table.checksum, entry + 4)
    directory.writeUInt32BE(offset, entry + 8)
    directory.writeUInt32BE(table.data.length, entry + 12)

    const padding = (4 - (table.data.length % 4)) % 4
    chunks.push(table.data, Buffer.alloc(padding))
    offset += table.data.length + padding
  })

  return Buffer.concat([header, directory, ...chunks])
}

/** Base64 en líneas cortas: un literal de 60 kB en una sola línea es ilegible. */
function toChunks(base64) {
  return (base64.match(/.{1,96}/g) ?? []).map(chunk => `  '${chunk}',`).join('\n')
}

const blocks = FONTS.map(([pkg, file, name]) => {
  const ttf = woffToTtf(readFileSync(join(source, pkg, 'files', file)))
  console.log(`${name}: ${ttf.length} bytes de TTF`)
  return `const ${name} = [\n${toChunks(ttf.toString('base64'))}\n].join('')`
})

const generated = `// GENERADO por build-fonts.cjs a partir de @fontsource. No editar a mano.
// IBM Plex — SIL Open Font License 1.1; ver LICENSE.txt en este directorio.

${blocks.join('\n\n')}

function decode(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Las tres tipografías del proyecto, listas para \`embedFont\`. */
export const DOCUMENT_FONTS = {
  regular: decode(REGULAR),
  semibold: decode(SEMIBOLD),
  mono: decode(MONO),
}
`

writeFileSync(join(__dirname, 'index.ts'), generated)
console.log(`index.ts: ${generated.length} caracteres`)
