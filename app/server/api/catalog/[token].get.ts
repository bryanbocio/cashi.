import type { Json } from '../../../app/types/database'

export default defineEventHandler(async (event): Promise<Json | null> => {
  const token = getRouterParam(event, 'token')?.trim().toLowerCase() ?? ''
  if (!/^[a-f0-9]{24}$/.test(token)) return null

  const config = useRuntimeConfig(event)
  const { url, key } = config.public.supabase

  try {
    return await $fetch<Json | null>(`${url}/rest/v1/rpc/get_public_catalog`, {
      method: 'POST',
      headers: { apikey: key },
      body: { p_catalog: token },
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'No pudimos cargar el catálogo.' })
  }
})
