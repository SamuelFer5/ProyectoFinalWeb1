import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { ConfirmDialog } from '../../components/ui/Modal'
import { adminService, type ViewStatusFilter } from '../../services/admin.service'
import { viewsService } from '../../services/views.service'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils/format'
import { toUserMessage } from '../../utils/errors'
import type { View } from '../../models'

const PAGE_SIZE = 20

const FILTROS: { id: ViewStatusFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'publicadas', label: 'Publicadas' },
  { id: 'despublicadas', label: 'Despublicadas' },
]

function isFiltro(value: string | null): value is ViewStatusFilter {
  return value !== null && FILTROS.some((item) => item.id === value)
}

/**
 * Pantalla 9 — Panel de superadmin: moderacion de contenido.
 *
 * Es la unica pantalla que ve las publicaciones despublicadas junto a las
 * activas: `GET /views` filtra siempre por `status: PUBLISHED`, mientras que
 * `GET /admin/views` no filtra salvo que se le pida.
 *
 * Los contadores se muestran separados por cara (A / B) y nunca sumados,
 * coherente con la premisa del proyecto: son magnitudes independientes.
 */
export function AdminModerationPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const estadoParam = searchParams.get('estado')
  const filtro: ViewStatusFilter = isFiltro(estadoParam) ? estadoParam : 'todas'
  const page = Number(searchParams.get('page') ?? '1') || 1

  const [publicaciones, setPublicaciones] = useState<View[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [objetivo, setObjetivo] = useState<View | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // --- Carga ----------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    adminService
      .listViews({ status: filtro, page, limit: PAGE_SIZE }, controller.signal)
      .then((resultado) => {
        setPublicaciones(resultado.data)
        setTotal(resultado.total)
        setTotalPages(Math.max(resultado.totalPages, 1))
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
  }, [filtro, page, reloadToken])

  /** Cambiar de filtro vuelve siempre a la pagina 1: el conjunto es otro. */
  const cambiarFiltro = (nuevo: ViewStatusFilter) => {
    const params = new URLSearchParams()
    if (nuevo !== 'todas') params.set('estado', nuevo)
    setSearchParams(params)
  }

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

  /**
   * Despublica o republica y parchea la fila en el sitio.
   *
   * Si hay un filtro de estado activo, la fila deja de pertenecer al conjunto
   * mostrado, asi que se retira en vez de quedarse contradiciendo al filtro.
   */
  const confirmar = useCallback(async () => {
    if (objetivo === null || isSaving) return

    const despublicando = objetivo.publicado

    setIsSaving(true)
    try {
      if (despublicando) {
        await viewsService.unpublish(objetivo.id)
      } else {
        await viewsService.publish(objetivo.id)
      }

      setPublicaciones((actuales) => {
        if (filtro !== 'todas') {
          return actuales.filter((item) => item.id !== objetivo.id)
        }
        return actuales.map((item) =>
          item.id === objetivo.id ? { ...item, publicado: !despublicando } : item,
        )
      })
      if (filtro !== 'todas') setTotal((actual) => Math.max(0, actual - 1))

      toast.success(despublicando ? 'Publicacion retirada del tablero' : 'Publicacion restaurada')
      setObjetivo(null)
    } catch (cause) {
      toast.error(toUserMessage(cause, 'No se pudo cambiar el estado de la publicacion.'))
      setObjetivo(null)
    } finally {
      setIsSaving(false)
    }
  }, [objetivo, isSaving, filtro, toast])

  const despublicando = objetivo?.publicado ?? false

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Moderacion de contenido</h1>
          <p className="admin-page__count">
            {isLoading
              ? 'Cargando...'
              : total === 1
                ? '1 publicacion'
                : `${total} publicaciones`}
          </p>
        </div>

        {/* Filtro por estado. Se usa un grupo de botones y no un <select>
            porque son solo tres opciones y el estado activo queda a la vista. */}
        <div className="tabs" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tabs__tab${filtro === item.id ? ' is-active' : ''}`}
              aria-pressed={filtro === item.id}
              onClick={() => {
                cambiarFiltro(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="page-center">
          <Spinner label="Cargando publicaciones" />
        </div>
      ) : error !== null ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setReloadToken((token) => token + 1)
          }}
        />
      ) : publicaciones.length === 0 ? (
        <EmptyState
          title={
            filtro === 'despublicadas'
              ? 'No hay publicaciones despublicadas'
              : filtro === 'publicadas'
                ? 'No hay publicaciones activas'
                : 'Todavia no hay publicaciones'
          }
          hint="Cambie el filtro de estado para ver el resto del contenido."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Publicaciones de la plataforma con sus reacciones por postura y su estado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Titulo</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Likes (A / B)</th>
                  <th scope="col">Dislikes (A / B)</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {publicaciones.map((view) => (
                  <tr key={view.id}>
                    <th scope="row" className="table__wrap-text">
                      {view.titulo}
                    </th>
                    <td>
                      <Link to={`/authors/${view.autor.id}`}>{view.autor.nombre}</Link>
                    </td>
                    <td>{view.categoria.nombre}</td>
                    <td>{formatDate(view.fechaCreacion)}</td>
                    {/* Separados por cara, nunca sumados. */}
                    <td>
                      {view.ladoA.likes} / {view.ladoB.likes}
                    </td>
                    <td>
                      {view.ladoA.dislikes} / {view.ladoB.dislikes}
                    </td>
                    <td>
                      <span
                        className={`badge ${view.publicado ? 'badge--success' : 'badge--error'}`}
                      >
                        {view.publicado ? 'Publicada' : 'Despublicada'}
                      </span>
                    </td>
                    <td>
                      <div className="table__actions">
                        <Link className="btn btn--ghost" to={`/views/${view.id}`}>
                          Ver detalle
                        </Link>
                        <button
                          type="button"
                          className={`btn ${view.publicado ? 'btn--danger' : 'btn--primary'}`}
                          onClick={() => {
                            setObjetivo(view)
                          }}
                        >
                          {view.publicado ? 'Despublicar' : 'Republicar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <ConfirmDialog
        open={objetivo !== null}
        titulo={despublicando ? 'Despublicar publicacion' : 'Republicar publicacion'}
        mensaje={
          despublicando
            ? `"${objetivo?.titulo ?? ''}" dejara de aparecer en el tablero publico. Solo su autor y los superadministradores podran verla.`
            : `"${objetivo?.titulo ?? ''}" volvera a aparecer en el tablero publico para todos los usuarios.`
        }
        confirmLabel={despublicando ? 'Despublicar' : 'Republicar'}
        danger={despublicando}
        busy={isSaving}
        onConfirm={() => {
          void confirmar()
        }}
        onClose={() => {
          setObjetivo(null)
        }}
      />
    </div>
  )
}
