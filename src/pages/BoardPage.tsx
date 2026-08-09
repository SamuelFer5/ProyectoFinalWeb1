import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * Resuelve los filtros iniciales con la precedencia correcta:
 * la URL manda (para que un enlace compartido se abra tal cual), y solo si la
 * URL viene limpia se recuperan las preferencias guardadas del usuario.
 */
function resolveInitialFilters(params: URLSearchParams): BoardFilters {
  const fromUrl: BoardFilters = {
    category: params.get('category'),
    hashtags: params.get('hashtag')?.split(',').filter(Boolean) ?? [],
    sort: isSortOption(params.get('sort')) ? (params.get('sort') as SortOption) : 'recientes',
  }

  const urlHasFilters =
    fromUrl.category !== null || fromUrl.hashtags.length > 0 || params.get('sort') !== null

  if (urlHasFilters) return fromUrl

  return (
    cacheService.get<BoardFilters>(CACHE_KEYS.filters) ?? {
      category: null,
      hashtags: [],
      sort: 'recientes',
    }
  )
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

  const [filters, setFilters] = useState<BoardFilters>(() =>
    resolveInitialFilters(searchParams),
  )
  const [page, setPage] = useState(() => Number(searchParams.get('page') ?? '1') || 1)

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

  // --- Persistencia y sincronizacion de filtros con la URL ------------------
  useEffect(() => {
    cacheService.set<BoardFilters>(CACHE_KEYS.filters, filters)

    const next = new URLSearchParams()
    if (filters.category) next.set('category', filters.category)
    if (filters.hashtags.length > 0) next.set('hashtag', filters.hashtags.join(','))
    if (filters.sort !== 'recientes') next.set('sort', filters.sort)
    if (page > 1) next.set('page', String(page))

    setSearchParams(next, { replace: true })
  }, [filters, page, setSearchParams])

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

  const handleFiltersChange = useCallback((next: BoardFilters) => {
    setFilters(next)
    setPage(1)
  }, [])

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
                  <ViewCard key={view.id} view={view} favoriteIds={favoriteIds} />
                ))}
              </div>

              {totalPages > 1 ? (
                <nav className="pagination" aria-label="Paginacion de publicaciones">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((current) => Math.max(1, current - 1))
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
                      setPage((current) => Math.min(totalPages, current + 1))
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
