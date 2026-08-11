/**
 * CacheService — unico punto de acceso a localStorage de toda la aplicacion.
 *
 * El enunciado (seccion 3.5) prohibe explicitamente que los componentes toquen
 * `localStorage` directamente. Todo pasa por aqui, que ademas:
 *   - serializa / deserializa JSON automaticamente,
 *   - guarda un `timestamp` de escritura junto a cada entrada,
 *   - valida el TTL en la lectura y sabe devolver datos caducados a proposito
 *     cuando el API no responde (patron stale-while-revalidate).
 */

/** Las 8 claves requeridas por el enunciado. */
export const CACHE_KEYS = {
  auth: 'lasdoscaras_auth',
  categories: 'lasdoscaras_categories',
  hashtags: 'lasdoscaras_hashtags',
  filters: 'lasdoscaras_filters',
  favorites: 'lasdoscaras_favorites',
  draft: 'lasdoscaras_draft',
  theme: 'lasdoscaras_theme',
  history: 'lasdoscaras_history',
  /**
   * Clave complementaria (no exigida por el enunciado): instantanea del ultimo
   * tablero cargado. Existe para cumplir el requisito de "mostrar las ultimas
   * publicaciones cacheadas" sin sobrescribir `lasdoscaras_filters`, que debe
   * guardar unicamente las preferencias de filtrado del usuario.
   */
  board: 'lasdoscaras_board',
} as const

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS]

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/**
 * Tiempo de vida por clave. Las claves ausentes de este mapa son permanentes
 * (sin TTL) por decision del enunciado: filtros, tema, borrador e historial
 * deben sobrevivir indefinidamente hasta que el usuario los cambie.
 */
export const CACHE_TTL: Partial<Record<CacheKey, number>> = {
  [CACHE_KEYS.categories]: 1 * HOUR,
  [CACHE_KEYS.hashtags]: 30 * MINUTE,
}

/** Maximo de entradas del historial de publicaciones vistas. */
export const HISTORY_LIMIT = 20

interface CacheEnvelope<T> {
  value: T
  timestamp: number
}

/** Resultado de una lectura tolerante: informa si el dato estaba caducado. */
export interface StaleRead<T> {
  value: T
  expired: boolean
  timestamp: number
}

function isEnvelope<T>(raw: unknown): raw is CacheEnvelope<T> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'value' in raw &&
    'timestamp' in raw &&
    typeof (raw as CacheEnvelope<T>).timestamp === 'number'
  )
}

/** Escribe un valor envuelto con su timestamp de escritura. */
function set<T>(key: CacheKey, value: T): void {
  try {
    const envelope: CacheEnvelope<T> = { value, timestamp: Date.now() }
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch (error) {
    // Cuota agotada o modo privado: la app debe seguir funcionando sin cache.
    console.warn(`[CacheService] No se pudo escribir "${key}"`, error)
  }
}

/**
 * Lectura tolerante: devuelve el dato aunque haya expirado, marcandolo con
 * `expired`. Es la primitiva sobre la que se construye el modo sin conexion.
 */
function readRaw<T>(key: CacheKey): StaleRead<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isEnvelope<T>(parsed)) {
      // Entrada escrita por una version anterior o corrupta: se descarta.
      localStorage.removeItem(key)
      return null
    }

    const ttl = CACHE_TTL[key]
    const expired = ttl !== undefined && Date.now() > parsed.timestamp + ttl
    return { value: parsed.value, expired, timestamp: parsed.timestamp }
  } catch (error) {
    console.warn(`[CacheService] Entrada invalida en "${key}"`, error)
    localStorage.removeItem(key)
    return null
  }
}

/**
 * Lectura estricta: si la entrada supero su TTL se comporta como si no
 * existiera, forzando al llamador a pedir datos frescos al API.
 */
function get<T>(key: CacheKey): T | null {
  const entry = readRaw<T>(key)
  if (entry === null || entry.expired) return null
  return entry.value
}

/** Lectura que conserva los datos caducados, para usarlos si el API falla. */
function getStale<T>(key: CacheKey): StaleRead<T> | null {
  return readRaw<T>(key)
}

function remove(key: CacheKey): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`[CacheService] No se pudo borrar "${key}"`, error)
  }
}

/**
 * Limpia lo que pertenece a la sesion del usuario y nada mas.
 *
 * El tema, los filtros y el historial son preferencias del navegador, no de la
 * cuenta: sobreviven deliberadamente al cierre de sesion. El borrador tambien
 * se conserva para no destruir texto que el usuario escribio.
 */
function clearSession(): void {
  remove(CACHE_KEYS.auth)
  remove(CACHE_KEYS.favorites)
}

export const cacheService = {
  set,
  get,
  getStale,
  remove,
  clearSession,
}
