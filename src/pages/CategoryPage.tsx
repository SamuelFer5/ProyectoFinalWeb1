import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FilterPanel } from '../components/views/FilterPanel'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { catalogService } from '../services/catalog.service'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { isApiError } from '../models'
import { toUserMessage } from '../utils/errors'
import type { BoardFilters, Category, Hashtag, SortOption, View } from '../models'

const PAGE_SIZE = 9

const SORT_VALUES: SortOption[] = ['recientes', 'likesA', 'likesB']

function isSortOption(value: string | null): value is SortOption {
  return value !== null && SORT_VALUES.includes(value as SortOption)
}

/**
 * Pantalla 6 — Pagina de categoria.
 *
 * Es el tablero acotado a una sola categoria. Reutiliza literalmente los mismos
 * componentes (`FilterPanel`, `ViewCard`) y el mismo servicio que la Pantalla 1;
 * la unica diferencia estructural es que aqui la categoria NO es un filtro que
 * el usuario pueda cambiar, sino el contexto fijo que da la URL. Por eso el
 * selector de categoria se oculta con `hideCategory` en vez de duplicar el
 * panel de filtros.
 */
export function CategoryPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Igual que en el tablero, los filtros se DERIVAN de la URL en cada render:
  // asi un enlace compartido, el boton Atras y un cambio de filtro se
  // comportan todos igual. La categoria no sale de aqui: viene de la ruta.
  const filters = useMemo<BoardFilters>(() => {
    const sort = searchParams.get('sort')
    return {
      category: id,
      hashtags: searchParams.get('hashtag')?.split(',').filter(Boolean) ?? [],
      sort: isSortOption(sort) ? sort : 'recientes',
    }
  }, [searchParams, id])

  const page = Number(searchParams.get('page') ?? '1') || 1

  const [category, setCategory] = useState<Category | null>(null)
  const [hashtags, setHashtags] = useState<Hashtag[]>(() => catalogService.readStaleHashtags())
  const [views, setViews] = useState<View[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => favoritesService.readIds())

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // --- Catalogo de hashtags para las sugerencias del filtro -----------------
  useEffect(() => {
    const controller = new AbortController()

    catalogService
      .fetchHashtags(controller.signal)
      .then(setHashtags)
      .catch(() => {
        // Silencioso: el filtro sigue sugiriendo desde el catalogo cacheado.
      })

    return () => {
      controller.abort()
    }
  }, [])

  // --- Metadatos de la categoria + sus publicaciones ------------------------
  useEffect(() => {
    if (!id) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setNotFound(false)

    // Las dos peticiones son independientes: se lanzan en paralelo.
    Promise.all([
      catalogService.fetchCategory(id, controller.signal),
      viewsService.list({ ...filters, page, limit: PAGE_SIZE }, controller.signal),
    ])
      .then(([meta, resultado]) => {
        setCategory(meta)
        setViews(resultado.data)
        setTotal(resultado.total)
        setTotalPages(Math.max(resultado.totalPages, 1))
        setFavoriteIds(favoritesService.readIds())
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return

        // El API responde 404 tanto si la categoria no existe como si fue
        // desactivada (borrado logico): el enunciado pide tratarlo aparte del
        // error generico, con un mensaje que explique que paso.
        if (isApiError(cause) && cause.status === 404) {
          setNotFound(true)
          return
        }
        setError(toUserMessage(cause, 'No se pudieron cargar las publicaciones.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, filters, page, reloadToken])

  /**
   * Los filtros se escriben en la URL, que es de donde se leen. La categoria se
   * descarta del objeto: vive en la ruta, no en el query string.
   */
  const handleFiltersChange = useCallback(
    (next: BoardFilters) => {
      const params = new URLSearchParams()
      if (next.hashtags.length > 0) params.set('hashtag', next.hashtags.join(','))
      if (next.sort !== 'recientes') params.set('sort', next.sort)
      setSearchParams(params)
    },
    [setSearchParams],
  )

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams)
      if (nextPage > 1) {
        params.set('page', String(nextPage))
      } else {
        params.delete('page')
      }
      setSearchParams(params)
    },
    [searchParams, setSearchParams],
  )

  if (notFound) {
    return (
      <EmptyState
        title="Esta categoria no existe o fue desactivada"
        hint="Es posible que un administrador la haya retirado de la plataforma."
      >
        <Link className="btn btn--primary" to="/">
          Volver al tablero
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="board">
      {/* Migas de pan. "Categorias" no es enlace porque la aplicacion no tiene
          un indice de categorias: el acceso es por el menu de la navbar. */}
      <nav className="breadcrumb" aria-label="Miga de pan">
        <ol>
          <li>
            <Link to="/">Inicio</Link>
          </li>
          <li>Categorias</li>
          <li aria-current="page">{category?.nombre ?? 'Cargando...'}</li>
        </ol>
      </nav>

      <header className="board__intro">
        <h1>{category?.nombre ?? 'Categoria'}</h1>
        {/* El API no almacena descripcion de categoria: solo se pinta si algun
            dia la provee, en vez de dejar un parrafo vacio. */}
        {category?.descripcion ? <p>{category.descripcion}</p> : null}
        {!isLoading ? (
          <p className="board__count">
            {total === 1 ? '1 publicacion' : `${total} publicaciones`} en esta categoria
          </p>
        ) : null}
      </header>

      <div className="board__layout">
        <FilterPanel
          filters={filters}
          categories={[]}
          hashtags={hashtags}
          onChange={handleFiltersChange}
          // La categoria es el contexto de la pantalla, no un filtro editable.
          hideCategory
        />

        <section className="board__results" aria-label="Publicaciones de la categoria">
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
              title="No hay publicaciones en esta categoria"
              hint="Pruebe quitando el hashtag activo, o sea el primero en publicar aqui."
            >
              <Link className="btn btn--primary" to="/views/new">
                Crear publicacion
              </Link>
            </EmptyState>
          ) : (
            <>
              <div className="card-grid">
                {views.map((view) => (
                  <ViewCard
                    key={view.id}
                    view={view}
                    favorito={view.esFavorita || favoriteIds.includes(view.id)}
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
