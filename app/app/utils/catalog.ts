import type { Json } from '~/types/database'

export type PublicCatalogProduct = {
  id: string
  name: string
  category: string | null
  price: number
  available: boolean
}
export type PublicCatalog = {
  business: {
    name: string
    currency: string
    phone: string | null
    address: string | null
  }
  products: PublicCatalogProduct[]
}

function isRecord(value: unknown): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function toPublicCatalog(value: Json | null): PublicCatalog | null {
  if (!isRecord(value) || !isRecord(value.business) || !Array.isArray(value.products)) return null

  const business = value.business
  if (typeof business.name !== 'string' || typeof business.currency !== 'string') return null

  const products = value.products.flatMap((entry): PublicCatalogProduct[] => {
    if (!isRecord(entry)) return []
    if (
      typeof entry.id !== 'string'
      || typeof entry.name !== 'string'
      || typeof entry.price !== 'number'
      || typeof entry.available !== 'boolean'
    ) return []

    return [{
      id: entry.id,
      name: entry.name,
      category: typeof entry.category === 'string' ? entry.category : null,
      price: entry.price,
      available: entry.available,
    }]
  })

  return {
    business: {
      name: business.name,
      currency: business.currency,
      phone: typeof business.phone === 'string' ? business.phone : null,
      address: typeof business.address === 'string' ? business.address : null,
    },
    products,
  }
}
