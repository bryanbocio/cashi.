/**
 * Formato de dinero y porcentajes según el negocio activo.
 *
 * Los montos viajan como enteros en la moneda del negocio (COP sin decimales),
 * así que aquí nunca se divide entre 100 ni se acumulan decimales: solo se
 * presenta lo que ya calculó Postgres.
 */
export function useMoney() {
  const businessStore = useBusinessStore()

  const currency = computed(() => businessStore.activeBusiness?.currency ?? 'COP')

  const moneyFormatter = computed(() => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency.value,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }))

  const numberFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

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
    return `${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value)} %`
  }

  return { currency, formatMoney, formatNumber, formatPercent }
}
