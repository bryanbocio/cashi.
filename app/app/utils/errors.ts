export type ErrorLike = {
  code?: string
  message?: string
  status?: number
}

const messagesByCode: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.',
  user_already_exists: 'Ya existe una cuenta con este correo.',
  weak_password: 'La contraseña no cumple los requisitos de seguridad.',
  over_email_send_rate_limit: 'Espera unos minutos antes de solicitar otro correo.',
  same_password: 'La nueva contraseña debe ser diferente de la actual.',
  session_not_found: 'Tu sesión venció. Vuelve a iniciar sesión.',
  '23503': 'No se puede completar porque el registro está siendo utilizado.',
  '23505': 'Ya existe un registro con esos datos.',
  '42501': 'No tienes permiso para realizar esta acción.',
  PGRST116: 'No encontramos el registro solicitado.',
}

const messagePatterns: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'El correo o la contraseña no son correctos.'],
  [/email not confirmed/i, 'Confirma tu correo antes de iniciar sesión.'],
  [/user already registered|already been registered/i, 'Ya existe una cuenta con este correo.'],
  [/rate limit|too many requests/i, 'Has realizado demasiados intentos. Espera unos minutos.'],
  [/jwt.*expired|token.*expired/i, 'Tu sesión venció. Vuelve a iniciar sesión.'],
  [/row-level security|permission denied/i, 'No tienes permiso para realizar esta acción.'],
  [/duplicate key|unique constraint/i, 'Ya existe un registro con esos datos.'],
  [/foreign key constraint/i, 'No se puede completar porque el registro está siendo utilizado.'],
  [/failed to fetch|network error|fetch failed/i, 'No pudimos conectar con el servicio. Revisa tu conexión.'],
]

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error === 'string') return { message: error }
  if (error && typeof error === 'object') return error as ErrorLike
  return {}
}

export function toUserMessage(
  error: unknown,
  fallback = 'No pudimos completar la operación. Inténtalo nuevamente.',
): string {
  const normalized = asErrorLike(error)
  const code = normalized.code?.trim()
  const message = normalized.message?.trim()

  if (code && messagesByCode[code]) return messagesByCode[code]

  if (message) {
    const match = messagePatterns.find(([pattern]) => pattern.test(message))
    if (match) return match[1]

    const firstLine = message.split(/\r?\n/, 1)[0]?.trim()
    const looksSafe = firstLine
      && firstLine.length <= 180
      && !/constraint|relation |column |syntax|stack|postgres|sqlstate/i.test(firstLine)

    if (looksSafe) return firstLine
  }

  if (normalized.status === 429) return 'Has realizado demasiados intentos. Espera unos minutos.'
  if (normalized.status && normalized.status >= 500) return 'El servicio no está disponible temporalmente.'

  return fallback
}
