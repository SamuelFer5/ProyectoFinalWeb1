import { isApiError, type FieldErrors } from '../models'

/**
 * Convierte cualquier excepcion en un mensaje presentable.
 *
 * Regla del enunciado: nunca mostrar la excepcion tecnica cruda al usuario.
 * Todo lo que no sea un `ApiError` conocido cae en un mensaje generico y se
 * registra en consola para depuracion.
 */
export function toUserMessage(error: unknown, fallback = 'Ocurrio un error inesperado.'): string {
  if (isApiError(error)) return error.message

  console.error('[error] Excepcion no controlada', error)
  return fallback
}

/** Extrae los errores por campo de un 400 / 422 para pintarlos inline. */
export function toFieldErrors(error: unknown): FieldErrors {
  return isApiError(error) ? error.fieldErrors : {}
}

/** `true` si el fallo fue de red o timeout, no una respuesta del servidor. */
export function isOfflineError(error: unknown): boolean {
  return isApiError(error) && error.isNetworkError
}
