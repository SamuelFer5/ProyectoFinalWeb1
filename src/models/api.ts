/** Sobre de paginacion devuelto por los listados del API. */
export interface Paginated<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Mapa campo -> mensaje, usado para pintar errores 400/422 inline. */
export type FieldErrors = Record<string, string>

/**
 * Error normalizado de la capa de servicio.
 *
 * Toda la aplicacion trabaja contra este tipo y nunca contra la excepcion cruda
 * de `fetch`, de modo que los componentes puedan decidir que mostrar en funcion
 * de `status` y `fieldErrors` sin volver a inspeccionar la respuesta HTTP.
 */
export class ApiError extends Error {
  /** Codigo HTTP, o 0 cuando el fallo fue de red / timeout. */
  readonly status: number
  /** Errores por campo devueltos por el API en un 400 o 422. */
  readonly fieldErrors: FieldErrors
  /** `true` cuando no hubo respuesta del servidor (offline, DNS, timeout). */
  readonly isNetworkError: boolean

  constructor(
    status: number,
    message: string,
    fieldErrors: FieldErrors = {},
    isNetworkError = false,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.isNetworkError = isNetworkError
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
