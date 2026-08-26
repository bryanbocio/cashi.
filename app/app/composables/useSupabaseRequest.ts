import { useToast } from 'primevue/usetoast'
import { toUserMessage } from '~/utils/errors'

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

  function notifyError(error: unknown, options: RequestOptions = {}) {
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
