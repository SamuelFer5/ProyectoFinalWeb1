import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState, Spinner } from '../components/ui/States'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { historyService } from '../services/history.service'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime } from '../utils/format'
import { toUserMessage } from '../utils/errors'
import type { HistoryEntry, View } from '../models'

const PAGE_SIZE = 20

const TABS = ['publicaciones', 'favoritos', 'historial'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  publicaciones: 'Mis Publicaciones',
  favoritos: 'Mis Favoritos',
  historial: 'Historial',
}

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as readonly string[]).includes(value)
}

const ROLE_LABELS: Record<string, string> = {
  user: 'Usuario',
  superadmin: 'Superadministrador',
}

/**
 * Pantalla 10 — Perfil de usuario.
 *
 * Tres secciones con origenes de datos deliberadamente distintos, que es lo que
 * el enunciado evalua aqui:
 *
 *   - Mis Publicaciones: `GET /views?autor=me`, con acceso a editar cada una.
 *   - Mis Favoritos: los IDs vienen de `GET /users/me/favorites` y cada
 *     publicacion se pide por separado (ver nota en la carga).
 *   - Historial: se lee INTEGRAMENTE de `lasdoscaras_history`, sin tocar el API.
 *
 * Cada seccion se carga la primera vez que se abre su pestana, no al montar la
 * pantalla: quien entra a ver su historial no deberia disparar dos listados que
 * no va a mirar.
 */
export function ProfilePage() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // La pestana activa vive en la URL (`?tab=`) para que recargar o compartir el
  // enlace devuelva la misma seccion, igual que los filtros del tablero.
  const tabParam = searchParams.get('tab')
  const activeTab: Tab = isTab(tabParam) ? tabParam : 'publicaciones'

  // --- Mis publicaciones ----------------------------------------------------
  const [mine, setMine] = useState<View[] | null>(null)
  const [mineError, setMineError] = useState<string | null>(null)

  // --- Mis favoritos --------------------------------------------------------
  const [favorites, setFavorites] = useState<View[] | null>(null)
  const [favoritesError, setFavoritesError] = useState<string | null>(null)

  // --- Historial (local) ----------------------------------------------------
  const [history, setHistory] = useState<HistoryEntry[]>(() => historyService.read())

  const [reloadToken, setReloadToken] = useState(0)

  const selectTab = useCallback(
    (tab: Tab) => {
      const next = new URLSearchParams(searchParams)
      if (tab === 'publicaciones') next.delete('tab')
      else next.set('tab', tab)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // --- Carga de "Mis Publicaciones" -----------------------------------------
  useEffect(() => {
    if (activeTab !== 'publicaciones' || mine !== null) return

    const controller = new AbortController()
    setMineError(null)

    viewsService
      .list({ soloMias: true, page: 1, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setMine(result.data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setMineError(toUserMessage(cause, 'No se pudieron cargar sus publicaciones.'))
      })

    return () => {
      controller.abort()
    }
  }, [activeTab, mine, reloadToken])

  // --- Carga de "Mis Favoritos" ---------------------------------------------
  /**
   * `GET /users/me/favorites` devuelve UNICAMENTE los IDs, no las
   * publicaciones. Por eso hay que pedir cada una con `GET /views/:id`.
   *
   * Se usa `allSettled` y no `all` a proposito: si el superadmin despublico o
   * elimino una de las publicaciones guardadas, ese detalle falla con 404 y con
   * `all` se perderia la lista entera. Asi solo se descarta la que fallo.
   */
  useEffect(() => {
    if (activeTab !== 'favoritos' || favorites !== null) return

    const controller = new AbortController()
    setFavoritesError(null)

    favoritesService
      .sync(controller.signal)
      .then(async (ids) => {
        if (ids.length === 0) return []

        const results = await Promise.allSettled(
          ids.map((favoriteId) => viewsService.detail(favoriteId, controller.signal)),
        )

        return results
          .filter(
            (result): result is PromiseFulfilledResult<View> => result.status === 'fulfilled',
          )
          .map((result) => result.value)
      })
      .then((loaded) => {
        if (!controller.signal.aborted) setFavorites(loaded)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setFavoritesError(toUserMessage(cause, 'No se pudieron cargar sus favoritos.'))
      })

    return () => {
      controller.abort()
    }
  }, [activeTab, favorites, reloadToken])

  /** Quitar el favorito saca la tarjeta de la lista sin recargar la pantalla. */
  const handleFavoriteToggle = useCallback((viewId: string, isFavorite: boolean) => {
    if (isFavorite) return
    setFavorites((current) => current?.filter((view) => view.id !== viewId) ?? null)
  }, [])

  const handleClearHistory = () => {
    historyService.clear()
    setHistory([])
    toast.success('Historial borrado')
  }

  const handleLogout = () => {
    // `logout` limpia `lasdoscaras_auth` y `lasdoscaras_favorites`; el tema, los
    // filtros y el historial son del navegador y sobreviven a proposito.
    logout()
    toast.success('Sesion cerrada')
    navigate('/')
  }

  const retry = () => {
    setMine(null)
    setFavorites(null)
    setReloadToken((token) => token + 1)
  }

  return (
    <div className="profile">
      <header className="profile__header">
        <h1>Mi perfil</h1>
        <button type="button" className="btn btn--ghost" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </header>

      {user ? (
        <dl className="profile__data">
          <div>
            <dt>Nombre</dt>
            <dd>{user.nombre}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{ROLE_LABELS[user.rol] ?? user.rol}</dd>
          </div>
          <div>
            <dt>Miembro desde</dt>
            <dd>{formatDate(user.fechaRegistro)}</dd>
          </div>
        </dl>
      ) : (
        <Spinner label="Cargando perfil" />
      )}

      {/* Pestanas con el patron ARIA de tabs: los paneles se anuncian ligados a
          su boton y la seleccion se comunica con aria-selected. */}
      <div className="tabs" role="tablist" aria-label="Secciones del perfil">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            className={`tab${activeTab === tab ? ' tab--active' : ''}`}
            onClick={() => {
              selectTab(tab)
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* --- Mis Publicaciones ------------------------------------------- */}
      {activeTab === 'publicaciones' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-publicaciones"
          aria-labelledby="tab-publicaciones"
        >
          {mineError !== null ? (
            <ErrorState message={mineError} onRetry={retry} />
          ) : mine === null ? (
            <CardSkeletonGrid count={3} />
          ) : mine.length === 0 ? (
            <EmptyState
              title="Todavia no ha publicado ningun tema"
              hint="Publique un tema con su Postura y su Contrapostura para que aparezca aqui."
            >
              <Link className="btn btn--primary" to="/views/new">
                Crear publicacion
              </Link>
            </EmptyState>
          ) : (
            <ul className="profile-list">
              {mine.map((view) => (
                <li key={view.id} className="profile-item">
                  <div className="profile-item__main">
                    <Link className="profile-item__title" to={`/views/${view.id}`}>
                      {view.titulo}
                    </Link>
                    <p className="profile-item__meta">
                      <span className="badge badge--category">{view.categoria.nombre}</span>
                      <time dateTime={view.fechaCreacion}>{formatDate(view.fechaCreacion)}</time>
                      {!view.publicado ? (
                        <span className="badge badge--warning">Despublicada</span>
                      ) : null}
                    </p>
                    {!view.publicado ? (
                      <p className="profile-item__notice">
                        Un administrador retiro esta publicacion del tablero. Puede editarla,
                        pero no sera visible para el resto de usuarios.
                      </p>
                    ) : null}
                  </div>

                  <div className="profile-item__actions">
                    <Link className="btn btn--ghost" to={`/views/${view.id}`}>
                      Ver detalle
                    </Link>
                    <Link className="btn btn--primary" to={`/views/${view.id}/edit`}>
                      Editar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* --- Mis Favoritos ------------------------------------------------ */}
      {activeTab === 'favoritos' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-favoritos"
          aria-labelledby="tab-favoritos"
        >
          {favoritesError !== null ? (
            <ErrorState message={favoritesError} onRetry={retry} />
          ) : favorites === null ? (
            <CardSkeletonGrid count={3} />
          ) : favorites.length === 0 ? (
            <EmptyState
              title="No tiene publicaciones guardadas"
              hint="Use el corazon de cualquier tarjeta para guardar un tema y volver a el mas tarde."
            >
              <Link className="btn btn--ghost" to="/">
                Explorar el tablero
              </Link>
            </EmptyState>
          ) : (
            <div className="card-grid">
              {favorites.map((view) => (
                <ViewCard
                  key={view.id}
                  view={view}
                  favorito
                  onFavoriteToggle={(isFavorite) => {
                    handleFavoriteToggle(view.id, isFavorite)
                  }}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* --- Historial ---------------------------------------------------- */}
      {activeTab === 'historial' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-historial"
          aria-labelledby="tab-historial"
        >
          {history.length === 0 ? (
            <EmptyState
              title="Su historial esta vacio"
              hint="Las publicaciones que abra apareceran aqui, hasta un maximo de 20."
            />
          ) : (
            <>
              <div className="profile__panel-head">
                <p className="profile__hint">
                  Ultimas {history.length} publicaciones que abrio. Se guarda solo en este
                  navegador; no viaja al servidor.
                </p>
                <button type="button" className="btn btn--danger" onClick={handleClearHistory}>
                  Limpiar historial
                </button>
              </div>

              <ul className="profile-list">
                {history.map((entry) => (
                  <li key={`${entry.id}-${entry.fechaVista}`} className="profile-item">
                    <div className="profile-item__main">
                      <Link className="profile-item__title" to={`/views/${entry.id}`}>
                        {entry.titulo}
                      </Link>
                      <p className="profile-item__meta">
                        <span className="badge badge--category">{entry.categoria}</span>
                        <time dateTime={entry.fechaVista}>
                          Visto el {formatDateTime(entry.fechaVista)}
                        </time>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}