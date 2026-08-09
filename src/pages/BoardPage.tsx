import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FilterPanel } from '../components/views/FilterPanel'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { ConnectionBanner } from '../components/ui/ConnectionBanner'
import { catalogService } from '../services/catalog.service'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { CACHE_KEYS, cacheService } from '../services/cache.service'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { toUserMessage } from '../utils/errors'
import type { BoardFilters, Category, Hashtag, SortOption, View } from '../models'

const PAGE_SIZE = 9

const SORT_VALUES: SortOption[] = ['recientes', 'likesA', 'likesB']

function isSortOption(value: string | null): value is SortOption {
  return value !== null && SORT_VALUES.includes(value as SortOption)
}

/** Lee los filtros de la URL. Funcion pura: la URL es la fuente de verdad. */
function parseFilters(params: URLSearchParams): BoardFilters {
  const sort = params.get('sort')

  return {
    category: params.get('category'),
    hashtags: params.get('hashtag')?.split(',').filter(Boolean) ?? [],
    sort: isSortOption(sort) ? sort : 'recientes',
  }
}

function hasFilterParams(params: URLSearchParams): boolean {
  return params.has('category') || params.has('hashtag') || params.has('sort')
}

/** Serializa filtros y pagina a query params, omitiendo los valores por defecto. */
function toSearchParams(filters: BoardFilters, page: number): URLSearchParams {
  const next = new URLSearchParams()
  if (filters.category) next.set('category', filters.category)
  if (filters.hashtags.length > 0) next.set('hashtag', filters.hashtags.join(','))
  if (filters.sort !== 'recientes') next.set('sort', filters.sort)
  if (page > 1) next.set('page', String(page))
  return next
}

/**
 * Pantalla 1 — Tablero principal.
 *
 * Reune casi todos los requisitos transversales del enunciado: cache-first en
 * los catalogos, filtros persistidos y reflejados en la URL, los tres estados
 * de UI, paginacion y degradacion a datos cacheados cuando el API no responde.
 */
export function BoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isOnline = useOnlineStatus()

  /**
   * Filtros y pagina se DERIVAN de la URL en cada render en lugar de vivir en
   * `useState`.
   *
   * Con estado propio, un enlace entrante como `/?category=X` no tenia efecto
   * si el tablero ya estaba montado: el inicializador de `useState` solo corre
   * la primera vez, y el efecto que sincronizaba estado -> URL borraba el
   * parametro recien llegado. Derivarlos de la URL hace que el enlace del menu
   * de categorias, el boton Atras del navegador y un enlace compartido se
   * comporten todos igual.
   */
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const page = Number(searchParams.get('page') ?? '1') || 1

  // Los catalogos arrancan con lo que haya en cache: los filtros quedan
  // utilizables antes de que el API conteste (requisito de la seccion 3.5).
  const [categories, setCategories] = useState<Category[]>(() =>
    catalogService.readStaleCategories(),
  )
  const [hashtags, setHashtags] = useState<Hashtag[]>(() =>
    catalogService.readStaleHashtags(),
  )

  const [views, setViews] = useState<View[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isServingCache, setIsServingCache] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // Los favoritos se releen del cache junto con cada carga del listado, que es
  // el unico momento en que las tarjetas se vuelven a montar. Mantenerlos en
  // estado propio evita releer localStorage en cada render.
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    favoritesService.readIds(),
  )
  const wasOffline = useRef(!isOnline)

  // --- Catalogos: revalidacion en segundo plano -----------------------------
  useEffect(() => {
    const controller = new AbortController()

    catalogService
      .fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        // Silencioso: ya se estan mostrando las categorias del cache.
      })

    catalogService
      .fetchHashtags(controller.signal)
      .then(setHashtags)
      .catch(() => {
        // Idem: el autocomplete sigue funcionando con el catalogo cacheado.
      })

    return () => {
      controller.abort()
    }
  }, [])

  // --- Restauracion de los filtros guardados --------------------------------
  // Solo al entrar con la URL limpia: un enlace que ya trae filtros manda, y
  // las preferencias del usuario nunca deben pisarlo. `replace` evita dejar una
  // entrada intermedia en el historial del navegador.
  const yaRestaurado = useRef(false)

  useEffect(() => {
    if (yaRestaurado.current) return
    yaRestaurado.current = true

    if (hasFilterParams(searchParams)) return

    const guardados = cacheService.get<BoardFilters>(CACHE_KEYS.filters)
    if (!guardados) return

    const restaurados = toSearchParams(guardados, 1)
    if (restaurados.toString().length > 0) {
      setSearchParams(restaurados, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // --- Carga del listado ----------------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    viewsService
      .list({ ...filters, page, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setViews(result.data)
        setFavoriteIds(favoritesService.readIds())
        setTotalPages(Math.max(result.totalPages, 1))
        setIsServingCache(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return

        // Degradacion elegante: si hay algo en cache se muestra marcado como
        // informacion guardada; solo si no hay nada se ensena el error duro.
        const cached = viewsService.readCachedBoard()
        if (cached.length > 0) {
          setViews(cached)
          setFavoriteIds(favoritesService.readIds())
          setTotalPages(1)
          setIsServingCache(true)
        } else {
          setError(toUserMessage(cause, 'No se pudieron cargar las publicaciones.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [filters, page, reloadToken])

  // --- Recarga automatica al recuperar la conexion --------------------------
  useEffect(() => {
    if (isOnline && wasOffline.current) {
      setReloadToken((token) => token + 1)
    }
    wasOffline.current = !isOnline
  }, [isOnline])

  /**
   * Cambiar un filtro escribe en la URL (que es de donde se leen) y persiste
   * la preferencia. Se guarda aqui, en la accion explicita del usuario, y no en
   * un efecto sobre `filters`: un efecto tambien se dispararia en el primer
   * render con los valores por defecto y borraria lo que hubiera guardado.
   */
  const handleFiltersChange = useCallback(
    (next: BoardFilters) => {
      cacheService.set<BoardFilters>(CACHE_KEYS.filters, next)
      // Cualquier cambio de filtro vuelve a la pagina 1: la paginacion anterior
      // no tiene sentido sobre un conjunto de resultados distinto.
      setSearchParams(toSearchParams(next, 1))
    },
    [setSearchParams],
  )

  const goToPage = useCallback(
    (nextPage: number) => {
      setSearchParams(toSearchParams(filters, nextPage))
    },
    [filters, setSearchParams],
  )

  return (
    <div className="board">
      <header className="board__intro">
        <h1>Las dos narrativas de cada tema</h1>
        <p>
          Ningun tema tiene una sola cara. Cada publicacion presenta su Postura y su
          Contrapostura con fuentes propias, para que usted saque sus propias conclusiones.
        </p>
      </header>

      <ConnectionBanner showingCache={isServingCache} />

      <div className="board__layout">
        <FilterPanel
          filters={filters}
          categories={categories}
          hashtags={hashtags}
          onChange={handleFiltersChange}
        />

        <section className="board__results" aria-label="Publicaciones">
          {isLoading ? (
            <CardSkeletonGrid count={PAGE_SIZE} />
          ) : error !== null ? (
            <ErrorState
              message={error}
              onRetry={() => {
                setReloadToken((token) => token + 1)
              }}
            />
          ) : views.length === 0 ? (
            <EmptyState
              title="No hay publicaciones para estos filtros"
              hint="Pruebe quitando algun hashtag o cambiando la categoria seleccionada."
            />
          ) : (
            <>
              <div className="card-grid">
                {views.map((view) => (
                  <ViewCard
                    key={view.id}
                    view={view}
                    // Datos frescos: manda `esFavorita`, que el API calcula
                    // para el usuario del token. Datos del cache: manda la
                    // lista local de IDs, unica informacion disponible.
                    favorito={isServingCache ? favoriteIds.includes(view.id) : view.esFavorita}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="pagination" aria-label="Paginacion de publicaciones">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={page <= 1}
                    onClick={() => {
                      goToPage(Math.max(1, page - 1))
                    }}
                  >
                    Anterior
                  </button>
                  <span aria-current="page">
                    Pagina {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={page >= totalPages}
                    onClick={() => {
                      goToPage(Math.min(totalPages, page + 1))
                    }}
                  >
                    Siguiente
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
