import { ApiError, type FieldErrors } from '../models'
import { CACHE_KEYS, cacheService } from './cache.service'
import type { AuthSession } from '../models'

/**
 * Cliente HTTP centralizado — el unico lugar de la aplicacion donde se llama a
 * `fetch`. Concentra las cuatro responsabilidades que el enunciado exige de la
 * capa de servicio (seccion 3.2):
 *
 *   1. leer la URL base de la variable de entorno,
 *   2. adjuntar el JWT en cada solicitud autenticada,
 *   3. traducir cada codigo HTTP a un `ApiError` con mensaje util,
 *   4. reintentar una vez los GET que fallan por error de red.
 */

const BASE_URL = import.meta.env.VITE_API_URL

if (!BASE_URL) {
  console.error(
    '[http] Falta VITE_API_URL. Copie .env.example a .env y configure la URL del API.',
  )
}

/** Corta la espera para que un API caido no deje la UI colgada. */
const TIMEOUT_MS = 10_000

/** Un unico reintento en GET, tal como pide el enunciado. */
const GET_RETRIES = 1
const RETRY_DELAY_MS = 600

// --- Puente para el cierre de sesion global ---------------------------------
// El interceptor debe poder desmontar la sesion al recibir un 401, pero no
// puede importar el AuthContext sin crear una dependencia circular
// (contexto -> servicio -> contexto). En su lugar el contexto se suscribe aqui.

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

// --- Utilidades --------------------------------------------------------------

export type QueryParams = Record<
  string,
  string | number | boolean | string[] | null | undefined
>

/** Construye un query string omitiendo valores vacios, nulos o indefinidos. */
export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue

    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

function getToken(): string | null {
  const session = cacheService.get<AuthSession>(CACHE_KEYS.auth)
  return session?.token ?? null
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

// --- Traduccion de errores ---------------------------------------------------

/** Mensajes por defecto para cada codigo HTTP contemplado en la seccion 3.4. */
const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Revise los datos ingresados.',
  401: 'Su sesion ha expirado.',
  403: 'No tiene permiso para realizar esta accion.',
  404: 'El recurso solicitado no existe.',
  409: 'El recurso ya existe.',
  422: 'Los datos enviados no son validos.',
  500: 'Ocurrio un error en el servidor. Intente mas tarde.',
  502: 'Ocurrio un error en el servidor. Intente mas tarde.',
  503: 'Ocurrio un error en el servidor. Intente mas tarde.',
}

interface ApiErrorBody {
  message?: string
  mensaje?: string
  error?: string
  detalle?: string
  errors?: Record<string, string | string[]>
  errores?: Record<string, string | string[]>
}

/**
 * Normaliza el mapa de errores por campo. El API puede devolver un string o un
 * array de strings por campo; la UI siempre quiere un solo mensaje por input.
 */
function extractFieldErrors(body: ApiErrorBody): FieldErrors {
  const source = body.errors ?? body.errores
  if (!source) return {}

  const result: FieldErrors = {}
  for (const [field, message] of Object.entries(source)) {
    const text = Array.isArray(message) ? message[0] : message
    if (typeof text === 'string' && text.length > 0) result[field] = text
  }
  return result
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {}

  try {
    const text = await response.text()
    if (text) body = JSON.parse(text) as ApiErrorBody
  } catch {
    // Respuesta de error sin cuerpo JSON: se usa el mensaje por defecto.
  }

  const message =
    body.message ??
    body.mensaje ??
    body.detalle ??
    body.error ??
    DEFAULT_MESSAGES[response.status] ??
    'Ocurrio un error inesperado.'

  // Se registra en consola para depuracion, pero nunca se muestra crudo al
  // usuario: la UI solo consume `message`, que ya viene en lenguaje natural.
  if (response.status >= 500) {
    console.error(`[http] ${response.status} ${response.url}`, body)
  }

  return new ApiError(response.status, message, extractFieldErrors(body))
}

const NETWORK_ERROR_MESSAGE =
  'No fue posible conectar con el servidor. Verifique su conexion e intente de nuevo.'

// --- Nucleo del cliente ------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** `false` para endpoints publicos que no deben mandar el token. */
  auth?: boolean
  signal?: AbortSignal
}

async function performRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { method = 'GET', body, auth = true, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  // El timeout se combina con la senal del llamador para que un componente que
  // se desmonta pueda cancelar la peticion sin esperar los 10 segundos.
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort()
  }, TIMEOUT_MS)

  const signals = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signals,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  // Solo los GET se reintentan: repetir un POST podria duplicar un recurso.
  const maxAttempts = method === 'GET' ? GET_RETRIES + 1 : 1

  let lastNetworkError: ApiError | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response

    try {
      response = await performRequest(path, options)
    } catch (error) {
      // Cancelacion explicita del llamador: no es un fallo, no se reintenta.
      if (options.signal?.aborted) throw error

      lastNetworkError = new ApiError(0, NETWORK_ERROR_MESSAGE, {}, true)

      const isLastAttempt = attempt === maxAttempts - 1
      if (isLastAttempt) throw lastNetworkError

      console.warn(`[http] Reintentando GET ${path} (intento ${attempt + 2})`)
      await wait(RETRY_DELAY_MS)
      continue
    }

    if (response.ok) {
      // 204 No Content y respuestas vacias no traen JSON que parsear.
      if (response.status === 204) return undefined as T
      const text = await response.text()
      return (text ? JSON.parse(text) : undefined) as T
    }

    const apiError = await toApiError(response)

    // El 401 es el unico codigo con efecto global: invalida la sesion entera.
    if (apiError.status === 401) {
      cacheService.clearSession()
      onUnauthorized?.()
    }

    throw apiError
  }

  // Inalcanzable: el bucle sale por `return` o por `throw`.
  throw lastNetworkError ?? new ApiError(0, NETWORK_ERROR_MESSAGE, {}, true)
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
