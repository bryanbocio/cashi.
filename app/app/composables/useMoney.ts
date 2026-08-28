/**
 * Formato de dinero y porcentajes según el negocio activo.
 *
 * Los montos viajan como enteros en la moneda del negocio, así que aquí nunca
 * se divide entre 100 ni se acumulan decimales: solo se presenta lo que ya
 * calculó Postgres. Los dos decimales son de presentación —un entero de 1000
 * son mil pesos exactos, no diez—, no una unidad distinta.
 */

/** `1,000.00`: coma para los miles y punto para los decimales. */
export const MONEY_LOCALE = 'es-DO'

export function useMoney() {
  const businessStore = useBusinessStore()

  const currency = computed(() => businessStore.activeBusiness?.currency ?? 'COP')

  const moneyFormatter = computed(() => new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency: currency.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }))

  const numberFormatter = new Intl.NumberFormat(MONEY_LOCALE, { maximumFractionDigits: 0 })

  function formatMoney(amount: number | null | undefined) {
    if (amount === null || amount === undefined) return '—'
    return moneyFormatter.value.format(amount)
  }

  function formatNumber(value: number | null | undefined) {
    if (value === null || value === undefined) return '—'
    return numberFormatter.format(value)
  }

  /** El margen indefinido (precio en cero) llega como null y se muestra como raya. */
  function formatPercent(value: number | null | undefined) {
    if (value === null || value === undefined) return '—'
    return `${new Intl.NumberFormat(MONEY_LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value)} %`
  }

  return { currency, locale: MONEY_LOCALE, formatMoney, formatNumber, formatPercent }
}
