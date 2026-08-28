import { useToast } from 'primevue/usetoast'
import { isSessionExpiredError, toUserMessage } from '~/utils/errors'
import { goToExpiredSession } from '~/utils/session'

type SupabaseResult = {
  data: unknown
  error: unknown
}

type RequestOptions = {
  errorTitle?: string
  fallbackMessage?: string
  successMessage?: string
}

export function useSupabaseRequest() {
  const toast = useToast()
  const route = useRoute()

  function notifyError(error: unknown, options: RequestOptions = {}) {
    // Una sesión vencida no es un error de esta operación: llevarlo al login
    // con su aviso explica más que un Toast rojo sobre una pantalla ya inútil.
    if (isSessionExpiredError(error) && goToExpiredSession(route.fullPath)) return

    toast.add({
      severity: 'error',
      summary: options.errorTitle ?? 'No se pudo completar',
      detail: toUserMessage(error, options.fallbackMessage),
      life: 5000,
    })
  }

  async function execute<TResult extends SupabaseResult>(
    request: PromiseLike<TResult>,
    options: RequestOptions = {},
  ): Promise<TResult['data']> {
    try {
      const result = await request
      if (result.error) throw result.error

      if (options.successMessage) {
        toast.add({
          severity: 'success',
          summary: 'Listo',
          detail: options.successMessage,
          life: 3500,
        })
      }

      return result.data
    } catch (error) {
      notifyError(error, options)
      throw error
    }
  }

  return {
    execute,
    notifyError,
    toUserMessage,
  }
}
