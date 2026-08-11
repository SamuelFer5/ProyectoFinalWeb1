import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SidePanel } from '../components/views/SidePanel'
import { CommentThreads } from '../components/views/CommentThreads'
import { FavoriteButton } from '../components/views/FavoriteButton'
import { ShareButton } from '../components/views/ShareButton'
import { EmptyState, ErrorState, Spinner } from '../components/ui/States'
import { viewsService } from '../services/views.service'
import { historyService } from '../services/history.service'
import { favoritesService } from '../services/favorites.service'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { formatDate } from '../utils/format'
import { isApiError } from '../models'
import { toUserMessage } from '../utils/errors'
import type { Reaction, SideKey, Thread, View } from '../models'

/**
 * Pantalla 4 — Detalle de publicacion.
 *
 * Es la pantalla central del proyecto: aqui se materializa la premisa de
 * LasDosCaras. Las dos caras se renderizan con el mismo componente
 * (`SidePanel`) pero con objetos `Side` distintos, y cada reaccion viaja a un
 * endpoint propio del API (`/views/:id/sides/a/...` frente a `.../sides/b/...`),
 * de modo que los contadores no pueden contaminarse entre si ni en el cliente
 * ni en el servidor.
 *
 * Accesible para anonimos en modo lectura; reaccionar, comentar y guardar en
 * favoritos exige sesion iniciada.
 */
export function ViewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, isSuperadmin, user } = useAuth()
  const toast = useToast()

  const [view, setView] = useState<View | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [isModerating, setIsModerating] = useState(false)

  // --- Carga de la publicacion ----------------------------------------------
  useEffect(() => {
    if (!id) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    setNotFound(false)

    viewsService
      .detail(id, controller.signal)
      .then((loaded) => {
        setView(loaded)
        // Historial local: el enunciado pide registrar la visita SIN llamar al
        // API. `historyService` mantiene la cola FIFO de 20 entradas.
        historyService.record(loaded)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return

        // El 404 tiene tratamiento propio: no es un fallo de la aplicacion
        // sino un recurso inexistente, y el enunciado pide mensaje contextual.
        if (isApiError(cause) && cause.status === 404) {
          setNotFound(true)
          return
        }
        setError(toUserMessage(cause, 'No se pudo cargar la publicacion.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, reloadToken])

  // --- Carga de los hilos de comentarios ------------------------------------
  const loadThreads = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return
      try {
        setThreads(await viewsService.threads(id, signal))
      } catch {
        // Silencioso a proposito: que la discusion no cargue no debe tumbar la
        // pantalla; la publicacion en si ya esta visible y es lo importante.
      }
    },
    [id],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadThreads(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadThreads, reloadToken])

  /**
   * Aplica la reaccion y parchea UNICAMENTE la cara afectada.
   *
   * El API responde con los contadores de esa sola cara, asi que el estado se
   * actualiza de forma quirurgica: el objeto de la otra cara se conserva por
   * referencia y es literalmente imposible que cambie.
   */
  const handleReact = useCallback(
    async (sideKey: SideKey, reaction: Reaction) => {
      if (!id) return

      const patch = await viewsService.react(id, sideKey, reaction)

      setView((current) => {
        if (current === null) return current

        return sideKey === 'a'
          ? { ...current, ladoA: { ...current.ladoA, ...patch } }
          : { ...current, ladoB: { ...current.ladoB, ...patch } }
      })
    },
    [id],
  )

  /**
   * Despublicar / republicar — accion exclusiva del superadmin.
   *
   * Se confirma antes de ejecutar porque retira contenido del tablero publico,
   * y al terminar se parchea el estado local en lugar de recargar: el
   * enunciado pide que la vista refleje el cambio sin recargar la pagina.
   */
  const handleModerate = useCallback(async () => {
    if (!id || view === null || isModerating) return

    const despublicando = view.publicado
    const mensaje = despublicando
      ? 'Retirar esta publicacion del tablero publico?'
      : 'Devolver esta publicacion al tablero publico?'

    if (!window.confirm(mensaje)) return

    setIsModerating(true)
    try {
      if (despublicando) {
        await viewsService.unpublish(id)
      } else {
        await viewsService.publish(id)
      }

      setView((current) => (current === null ? current : { ...current, publicado: !despublicando }))
      toast.success(despublicando ? 'Publicacion retirada del tablero' : 'Publicacion restaurada')
    } catch (cause) {
      // El 403 se comunica como acceso denegado, sin expulsar al login: el
      // usuario puede estar autenticado y solo carecer del rol.
      toast.error(toUserMessage(cause, 'No se pudo cambiar el estado de la publicacion.'))
    } finally {
      setIsModerating(false)
    }
  }, [id, view, isModerating, toast])

  if (isLoading) {
    return (
      <div className="page-center">
        <Spinner label="Cargando publicacion" />
      </div>
    )
  }

  if (notFound) {
    return (
      <EmptyState
        title="Esta publicacion no existe o fue eliminada"
        hint="Es posible que un administrador la haya retirado del tablero."
      >
        <Link className="btn btn--primary" to="/">
          Volver al tablero
        </Link>
      </EmptyState>
    )
  }

  if (error !== null || view === null) {
    return (
      <ErrorState
        message={error ?? 'No se pudo cargar la publicacion.'}
        onRetry={() => {
          setReloadToken((token) => token + 1)
        }}
      />
    )
  }

  const esAutor = isAuthenticated && user?.id === view.autor.id

  return (
    <article className="detail">
      <header className="detail__header">
        <div className="detail__meta">
          <span className="badge badge--category">{view.categoria.nombre}</span>
          {/* Solo el autor o un superadmin pueden llegar a ver una publicacion
              retirada: para el resto el API responde 404. */}
          {!view.publicado ? (
            <span className="badge badge--warning">Despublicada</span>
          ) : null}
          {view.hashtags.map((hashtag) => (
            <span key={hashtag.id} className="badge badge--tag">
              #{hashtag.nombre}
            </span>
          ))}
        </div>

        <h1 className="detail__title">{view.titulo}</h1>

        <div className="detail__byline">
          {/* El autor enlaza a su perfil publico, requisito explicito. */}
          <Link to={`/authors/${view.autor.id}`}>{view.autor.nombre}</Link>
          <time dateTime={view.fechaCreacion}>{formatDate(view.fechaCreacion)}</time>

          <div className="detail__actions">
            <FavoriteButton
              viewId={view.id}
              initialActive={
                // Con sesion iniciada el API ya informa `isFavorite`; sin ella
                // el boton ni se pinta, pero el cache es el respaldo natural.
                isAuthenticated ? view.esFavorita : favoritesService.isFavorite(view.id)
              }
            />
            <ShareButton viewId={view.id} titulo={view.titulo} />

            {esAutor ? (
              <Link className="btn btn--ghost" to={`/views/${view.id}/edit`}>
                Editar
              </Link>
            ) : null}

            {isSuperadmin ? (
              <button
                type="button"
                className={`btn ${view.publicado ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => {
                  void handleModerate()
                }}
                disabled={isModerating}
              >
                {isModerating ? <Spinner label="Procesando" /> : null}
                {view.publicado ? 'Despublicar' : 'Republicar'}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Las dos caras, con reacciones y fuentes propias e independientes. */}
      <div className="detail__sides">
        <SidePanel side={view.ladoA} sideKey="a" heading="Postura" onReact={handleReact} />
        <SidePanel
          side={view.ladoB}
          sideKey="b"
          heading="Contrapostura"
          onReact={handleReact}
        />
      </div>

      <CommentThreads
        viewId={view.id}
        threads={threads}
        onReload={async () => {
          await loadThreads()
        }}
      />
    </article>
  )
}
