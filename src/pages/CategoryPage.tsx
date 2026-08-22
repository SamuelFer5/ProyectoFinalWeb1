import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FilterPanel } from '../components/views/FilterPanel'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { catalogService } from '../services/catalog.service'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { toUserMessage } from '../utils/errors'
import { parseFilters, toCategorySearchParams } from '../utils/filters'
import { isApiError } from '../models'
import type { BoardFilters, Category, Hashtag, View } from '../models'

const PAGE_SIZE = 9

/**
 * Pantalla 6 — Pagina de categoria.
 *
 * Misma rejilla, mismos filtros y mismo ordenamiento que el tablero, pero
 * acotados a una sola categoria. La categoria NO llega como filtro sino como
 * segmento de la ruta (`/categories/:id`), asi que el selector de categoria del
 * panel se oculta: cambiarlo aqui contradiria la URL en la que se esta.
 *
 * Los filtros de esta pantalla se reflejan en la URL pero NO se guardan en
 * `lasdoscaras_filters`: esa clave almacena las preferencias del tablero, y
 * pisarla desde aqui haria que el usuario volviera al tablero con un filtro que
 * nunca eligio ahi.
 */
export function CategoryPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<BoardFilters>(
    () => ({ ...parseFilters(searchParams), category: id }),
    [searchParams, id],
  )
  const page = Number(searchParams.get('page') ?? '1') || 1

  /**
   * La categoria arranca con la copia del catalogo cacheado: el encabezado se
   * pinta con su nombre real antes de que el API conteste, en vez de mostrar un
   * titulo vacio que salta al llegar la respuesta.
   */
  const [category, setCategory] = useState<Category | null>(
    () => catalogService.readStaleCategories().find((item) => item.id === id) ?? null,
  )
  const [hashtags, setHashtags] = useState<Hashtag[]>(() =>
    catalogService.readStaleHashtags(),
  )

  const [views, setViews] = useState<View[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => favoritesService.readIds())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** El enunciado pide 404 tanto si la categoria no existe como si esta inactiva. */
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // --- Catalogo de hashtags para el panel de filtros ------------------------
  useEffect(() => {
    const controller = new AbortController()

    catalogService
      .fetchHashtags(controller.signal)
      .then(setHashtags)
      .catch(() => {
        // Silencioso: el filtro sigue usable con los hashtags del cache.
      })

    return () => {
      controller.abort()
    }
  }, [])

  // --- Metadatos de la categoria -------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setNotFound(false)

    catalogService
      .fetchCategory(id, controller.signal)
      .then((found) => {
        // Borrado logico en el API: una categoria inactiva no debe ser visible.
        if (found.activo) setCategory(found)
        else setNotFound(true)
        })
            .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        // 404 = el id es un UUID valido pero no hay categoria con el.
        // 400 = el id ni siquiera es un UUID, asi que el API lo rechaza en la
        // validacion del parametro. Para el usuario ambos casos son lo mismo:
        // la categoria a la que intento entrar no existe.
        if (isApiError(cause) && (cause.status === 404 || cause.status === 400)) {
          setNotFound(true)
          return
        }
        // Otros fallos no bloquean: el listado sigue cargando y el encabezado
        // se queda con el nombre que hubiera en cache.
        console.warn('[CategoryPage] No se pudo cargar la categoria', cause)
      })

    return () => {
      controller.abort()
    }
  }, [id, reloadToken])

  // --- Publicaciones de la categoria ----------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    viewsService
      .list({ ...filters, page, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setViews(result.data)
        setFavoriteIds(favoritesService.readIds())
        setTotal(result.total)
        setTotalPages(Math.max(result.totalPages, 1))
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(toUserMessage(cause, 'No se pudieron cargar las publicaciones.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [filters, page, reloadToken])

  const handleFiltersChange = useCallback(
    (next: BoardFilters) => {
      setSearchParams(toCategorySearchParams(next, 1))
    },
    [setSearchParams],
  )

  const goToPage = useCallback(
    (nextPage: number) => {
      setSearchParams(toCategorySearchParams(filters, nextPage))
    },
    [filters, setSearchParams],
  )

  if (notFound) {
    return (
      <div className="error-page">
        <p className="error-page__code">404</p>
        <h1>Esta categoria no existe</h1>
        <p className="error-page__hint">
          Es posible que haya sido eliminada o desactivada por un administrador.
        </p>
        <Link className="btn btn--primary" to="/">
          Volver al tablero
        </Link>
      </div>
    )
  }

  return (
    <div className="category-page">
      <nav className="breadcrumb" aria-label="Migas de pan">
        <ol>
          <li>
            <Link to="/">Inicio</Link>
          </li>
          <li>
            {/* No existe una pantalla de indice de categorias: el tablero, que
                lista todas las publicaciones, es su equivalente funcional. */}
            <Link to="/">Categorias</Link>
          </li>
          <li aria-current="page">{category?.nombre ?? 'Categoria'}</li>
        </ol>
      </nav>

      <header className="category-page__header">
        <h1>{category?.nombre ?? 'Categoria'}</h1>
        {category?.descripcion ? (
          <p className="category-page__desc">{category.descripcion}</p>
        ) : null}
        <p className="category-page__meta">
          {isLoading
            ? 'Contando publicaciones...'
            : total === 1
              ? '1 publicacion en esta categoria'
              : `${total} publicaciones en esta categoria`}
        </p>
      </header>

      <div className="board__layout">
        <FilterPanel
          filters={filters}
          categories={[]}
          hashtags={hashtags}
          onChange={handleFiltersChange}
          hideCategory
        />

        <section className="board__results" aria-label={`Publicaciones de ${category?.nombre ?? 'la categoria'}`}>
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
              title="Esta categoria todavia no tiene publicaciones"
              hint="Pruebe quitando el hashtag activo o vuelva al tablero para ver todos los temas."
            >
              <Link className="btn btn--ghost" to="/">
                Ver todas las publicaciones
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