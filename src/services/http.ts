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

/**
 * Cuerpo de error del API. `errorHandler.ts` del backend responde siempre
 * `{ error, details? }`, donde `details` es el `ZodError.flatten()` de la
 * validacion fallida.
 */
interface ApiErrorBody {
  error?: string
  details?: {
    formErrors?: string[]
    /**
     * Ojo: `flatten()` agrupa por el PRIMER segmento de la ruta del error, y
     * los esquemas del API envuelven todo en `body` / `query` / `params`. Un
     * fallo en `body.password` llega, por tanto, como `{ body: [...] }` y no
     * como `{ password: [...] }`. `extractFieldErrors` deshace esa envoltura.
     */
    fieldErrors?: Record<string, string[]>
  }
}

/** Envoltorios que el API antepone a los campos reales en `fieldErrors`. */
const ZOD_WRAPPERS = new Set(['body', 'query', 'params'])

/**
 * Traduccion de los mensajes que el API emite en ingles.
 *
 * El backend responde en ingles y el enunciado exige mensajes especificos y
 * contextuales para el usuario final. En vez de mostrar el texto crudo (o de
 * perderlo cayendo siempre al mensaje generico del codigo HTTP), se traducen
 * los casos conocidos y el resto degrada al mensaje por defecto del status.
 */
const MESSAGE_TRANSLATIONS: { pattern: RegExp; message: string }[] = [
  { pattern: /email is already registered/i, message: 'El correo ya esta registrado.' },
  { pattern: /invalid email or password/i, message: 'Correo o contrasena incorrectos.' },
  {
    pattern: /account is pending activation/i,
    message: 'Su cuenta aun no ha sido activada. Vuelva a registrarse o contacte al administrador.',
  },
  {
    pattern: /account is suspended/i,
    message: 'Su cuenta ha sido suspendida. Contacte a un administrador.',
  },
  { pattern: /insufficient permissions/i, message: 'No tiene permiso para realizar esta accion.' },
  { pattern: /invalid or expired token|missing bearer token/i, message: 'Su sesion ha expirado.' },
  { pattern: /political view not found/i, message: 'Esta publicacion no existe o fue retirada.' },
  { pattern: /category (does not exist|not found)/i, message: 'La categoria seleccionada ya no existe.' },
  { pattern: /author not found/i, message: 'Este autor no existe.' },
  { pattern: /user not found/i, message: 'El usuario indicado no existe.' },
  { pattern: /comment thread not found/i, message: 'Este hilo de comentarios ya no existe.' },
  {
    pattern: /only the author or a superadmin/i,
    message: 'Solo el autor de la publicacion puede editarla.',
  },
  {
    pattern: /unique fields already exists/i,
    message: 'Ya existe un registro con esos datos.',
  },
  { pattern: /validation failed/i, message: 'Revise los datos ingresados.' },
  { pattern: /route not found/i, message: 'El recurso solicitado no existe.' },
  { pattern: /internal server error/i, message: 'Ocurrio un error en el servidor. Intente mas tarde.' },
]

function translate(raw: string | undefined): string | null {
  if (!raw) return null
  const match = MESSAGE_TRANSLATIONS.find((entry) => entry.pattern.test(raw))
  return match?.message ?? null
}

/**
 * Normaliza el mapa de errores por campo para pintarlos inline en el input que
 * corresponde. Descarta los envoltorios `body`/`query`/`params` que introduce
 * el esquema de validacion del API.
 */
function extractFieldErrors(body: ApiErrorBody): FieldErrors {
  const source = body.details?.fieldErrors
  if (!source) return {}

  const result: FieldErrors = {}
  for (const [field, messages] of Object.entries(source)) {
    if (ZOD_WRAPPERS.has(field)) continue
    const text = messages[0]
    if (typeof text === 'string' && text.length > 0) result[field] = text
  }
  return result
}

/**
 * Mensajes de validacion que quedaron atrapados bajo `body`/`query`/`params`.
 * Se agregan al mensaje global para que el usuario sepa QUE fallo aunque el
 * API no diga en cual campo.
 */
function extractWrappedDetail(body: ApiErrorBody): string | null {
  const source = body.details?.fieldErrors
  if (!source) return null

  for (const wrapper of ZOD_WRAPPERS) {
    const messages = source[wrapper]
    if (messages && messages.length > 0) return messages.join(' ')
  }
  return body.details?.formErrors?.[0] ?? null
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {}

  try {
    const text = await response.text()
    if (text) body = JSON.parse(text) as ApiErrorBody
  } catch {
    // Respuesta de error sin cuerpo JSON: se usa el mensaje por defecto.
  }

  const fieldErrors = extractFieldErrors(body)
  const detail = extractWrappedDetail(body)

  // Prioridad: traduccion conocida > detalle de validacion > mensaje por
  // codigo HTTP. La excepcion tecnica cruda nunca llega al usuario.
  const message =
    translate(body.error) ??
    (response.status === 400 || response.status === 422 ? detail : null) ??
    DEFAULT_MESSAGES[response.status] ??
    'Ocurrio un error inesperado.'

  // Se registra en consola para depuracion, tal como pide el enunciado para
  // los 5xx; el usuario solo ve `message`, ya en lenguaje natural.
  if (response.status >= 500) {
    console.error(`[http] ${response.status} ${response.url}`, body)
  }

  return new ApiError(response.status, message, fieldErrors)
}

const NETWORK_ERROR_MESSAGE =
  'No fue posible conectar con el servidor. Verifique su conexion e intente de nuevo.'

const TIMEOUT_MESSAGE =
  'El servidor tardo demasiado en responder. Intente de nuevo en un momento.'

/**
 * El API no contesto dentro de `TIMEOUT_MS`.
 *
 * Se distingue del fallo de red porque NO debe reintentarse: si la primera
 * llamada agoto los 10 segundos, la segunda va a agotarlos tambien y el usuario
 * termina esperando mas de veinte antes de ver el error.
 */
class TimeoutError extends Error {}

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
  } catch (error) {
    // La senal combinada no dice quien aborto: se consulta la del timeout, y se
    // descarta el caso en que el llamador ya habia cancelado por su cuenta.
    if (timeoutController.signal.aborted && !signal?.aborted) throw new TimeoutError()
    throw error
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

      // Un timeout tampoco: repetirlo solo duplica la espera del usuario.
      if (error instanceof TimeoutError) throw new ApiError(0, TIMEOUT_MESSAGE, {}, true)

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
