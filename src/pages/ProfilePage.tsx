import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { ConfirmDialog } from '../components/ui/Modal'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { historyService } from '../services/history.service'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { formatDate, formatDateTime } from '../utils/format'
import { toUserMessage } from '../utils/errors'
import type { HistoryEntry, View } from '../models'

/** Tope de publicaciones propias que se piden de una sola vez. */
const PAGE_SIZE = 50

const TABS = [
  { id: 'publicaciones', label: 'Mis Publicaciones' },
  { id: 'favoritos', label: 'Mis Favoritos' },
  { id: 'historial', label: 'Historial' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Etiquetas del rol; el modelo ya lo expone normalizado en espanol. */
const ROL_LABEL: Record<string, string> = {
  user: 'Usuario',
  superadmin: 'Superadministrador',
}

/**
 * Pantalla 10 — Perfil de usuario.
 *
 * Reune las tres colecciones que pertenecen al usuario, cada una con un origen
 * de datos distinto, y eso es justamente lo interesante de la pantalla:
 *
 *   - "Mis Publicaciones" sale del API (`GET /views?autor=me`),
 *   - "Mis Favoritos" sale del API pero en DOS pasos, porque el endpoint de
 *     favoritos solo devuelve IDs (ver `favoritesService.listViews`),
 *   - "Historial" no toca el API en absoluto: vive entero en
 *     `lasdoscaras_history`, tal como exige el enunciado.
 *
 * Los favoritos se cargan de forma perezosa, al abrir su pestana por primera
 * vez: al ser N+1 peticiones, pagarlas al entrar al perfil castigaria a quien
 * solo viene a ver sus publicaciones.
 */
export function ProfilePage() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabId>('publicaciones')
  const tablistRef = useRef<HTMLDivElement>(null)

  // --- Mis publicaciones ----------------------------------------------------
  const [publicaciones, setPublicaciones] = useState<View[]>([])
  const [cargandoPubs, setCargandoPubs] = useState(true)
  const [errorPubs, setErrorPubs] = useState<string | null>(null)
  const [pubsToken, setPubsToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setCargandoPubs(true)
    setErrorPubs(null)

    viewsService
      .list({ soloMias: true, page: 1, limit: PAGE_SIZE }, controller.signal)
      .then((resultado) => {
        setPublicaciones(resultado.data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setErrorPubs(toUserMessage(cause, 'No se pudieron cargar sus publicaciones.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoPubs(false)
      })

    return () => {
      controller.abort()
    }
  }, [pubsToken])

  // --- Mis favoritos --------------------------------------------------------
  const [favoritos, setFavoritos] = useState<View[]>([])
  const [cargandoFavs, setCargandoFavs] = useState(false)
  const [errorFavs, setErrorFavs] = useState<string | null>(null)
  /** Evita repetir las N+1 peticiones cada vez que se vuelve a la pestana. */
  const favsCargados = useRef(false)

  const cargarFavoritos = useCallback(async (signal?: AbortSignal) => {
    setCargandoFavs(true)
    setErrorFavs(null)

    try {
      setFavoritos(await favoritesService.listViews(signal))
      favsCargados.current = true
    } catch (cause) {
      if (signal?.aborted) return
      setErrorFavs(toUserMessage(cause, 'No se pudieron cargar sus favoritos.'))
    } finally {
      if (!signal?.aborted) setCargandoFavs(false)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'favoritos' || favsCargados.current) return

    const controller = new AbortController()
    void cargarFavoritos(controller.signal)

    return () => {
      controller.abort()
    }
  }, [tab, cargarFavoritos])

  // --- Historial ------------------------------------------------------------
  const [historial, setHistorial] = useState<HistoryEntry[]>(() => historyService.read())
  const [confirmarLimpieza, setConfirmarLimpieza] = useState(false)

  const limpiarHistorial = () => {
    historyService.clear()
    setHistorial([])
    setConfirmarLimpieza(false)
    toast.success('Historial vaciado')
  }

  // --- Sesion ---------------------------------------------------------------
  const handleLogout = () => {
    // `logout` limpia `lasdoscaras_auth` y `lasdoscaras_favorites` a la vez:
    // los favoritos son de la cuenta, no del navegador. El tema, los filtros y
    // el historial sobreviven a proposito (ver `cacheService.clearSession`).
    logout()
    toast.success('Sesion cerrada')
    navigate('/')
  }

  /**
   * Navegacion por teclado entre pestanas, segun el patron de tabs de WAI-ARIA:
   * las flechas mueven de pestana y Home/End saltan a los extremos. El foco
   * acompana a la seleccion para que un lector de pantalla anuncie el cambio.
   */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const actual = TABS.findIndex((item) => item.id === tab)
    let destino: number

    switch (event.key) {
      case 'ArrowRight':
        destino = (actual + 1) % TABS.length
        break
      case 'ArrowLeft':
        destino = (actual - 1 + TABS.length) % TABS.length
        break
      case 'Home':
        destino = 0
        break
      case 'End':
        destino = TABS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    setTab(TABS[destino].id)
    tablistRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [destino]?.focus()
  }

  return (
    <div className="profile">
      <header className="profile__header">
        <div>
          <h1>{user?.nombre ?? 'Mi perfil'}</h1>
          <dl className="profile__data">
            <div>
              <dt>Correo</dt>
              <dd>{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{user ? (ROL_LABEL[user.rol] ?? user.rol) : '—'}</dd>
            </div>
            <div>
              <dt>Miembro desde</dt>
              <dd>{user ? formatDate(user.fechaRegistro) : '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="profile__header-actions">
          <Link className="btn btn--primary" to="/views/new">
            Nueva publicacion
          </Link>
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <div
        className="tabs"
        role="tablist"
        aria-label="Secciones del perfil"
        ref={tablistRef}
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            className={`tabs__tab${tab === item.id ? ' is-active' : ''}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            // Roving tabindex: solo la pestana activa entra en el orden de
            // tabulacion; dentro del grupo se navega con las flechas.
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => {
              setTab(item.id)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* --- Mis publicaciones ------------------------------------------- */}
      {tab === 'publicaciones' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-publicaciones"
          aria-labelledby="tab-publicaciones"
          tabIndex={0}
        >
          {cargandoPubs ? (
            <CardSkeletonGrid count={6} />
          ) : errorPubs !== null ? (
            <ErrorState
              message={errorPubs}
              onRetry={() => {
                setPubsToken((token) => token + 1)
              }}
            />
          ) : publicaciones.length === 0 ? (
            <EmptyState
              title="Todavia no ha publicado ningun tema"
              hint="Publique su primer tema con su Postura y su Contrapostura."
            >
              <Link className="btn btn--primary" to="/views/new">
                Crear publicacion
              </Link>
            </EmptyState>
          ) : (
            <>
              {/*
                El listado del API filtra siempre por `status: PUBLISHED`, de
                modo que una publicacion despublicada por un superadmin deja de
                aparecer aqui. Se avisa para que su ausencia no se lea como una
                perdida de datos: la publicacion sigue existiendo y su autor
                puede abrirla por enlace directo.
              */}
              <p className="profile__note">
                Solo se listan sus publicaciones activas. Si un superadministrador
                despublica alguna, deja de aparecer en esta lista, pero no se elimina.
              </p>

              <div className="card-grid">
                {publicaciones.map((view) => (
                  <div className="profile__owned" key={view.id}>
                    <ViewCard view={view} favorito={view.esFavorita} />

                    {!view.publicado ? (
                      <p className="profile__unpublished" role="status">
                        Esta publicacion fue despublicada por un administrador.
                      </p>
                    ) : null}

                    <div className="profile__owned-actions">
                      <Link className="btn btn--ghost" to={`/views/${view.id}`}>
                        Ver detalle
                      </Link>
                      <Link className="btn btn--ghost" to={`/views/${view.id}/edit`}>
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* --- Mis favoritos ------------------------------------------------ */}
      {tab === 'favoritos' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-favoritos"
          aria-labelledby="tab-favoritos"
          tabIndex={0}
        >
          {cargandoFavs ? (
            <CardSkeletonGrid count={3} />
          ) : errorFavs !== null ? (
            <ErrorState
              message={errorFavs}
              onRetry={() => {
                void cargarFavoritos()
              }}
            />
          ) : favoritos.length === 0 ? (
            <EmptyState
              title="No ha guardado ninguna publicacion"
              hint="Use el corazon de cualquier tarjeta para guardarla y volver a ella despues."
            >
              <Link className="btn btn--primary" to="/">
                Explorar el tablero
              </Link>
            </EmptyState>
          ) : (
            <div className="card-grid">
              {favoritos.map((view) => (
                <ViewCard
                  key={view.id}
                  view={view}
                  favorito
                  // Al quitarlo de favoritos la tarjeta se retira de la lista:
                  // es la unica pantalla donde dejar de ser favorito significa
                  // dejar de pertenecer a la coleccion que se esta mostrando.
                  onFavoriteChange={(esFavorito) => {
                    if (!esFavorito) {
                      setFavoritos((actuales) =>
                        actuales.filter((item) => item.id !== view.id),
                      )
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* --- Historial ---------------------------------------------------- */}
      {tab === 'historial' ? (
        <section
          className="profile__panel"
          role="tabpanel"
          id="panel-historial"
          aria-labelledby="tab-historial"
          tabIndex={0}
        >
          {historial.length === 0 ? (
            <EmptyState
              title="Su historial esta vacio"
              hint="Las publicaciones que abra apareceran aqui, sin salir de su navegador."
            />
          ) : (
            <>
              <div className="profile__history-header">
                <p className="profile__note">
                  Las ultimas {historial.length} publicaciones que abrio. Se guardan solo
                  en este navegador; no se consultan al servidor.
                </p>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    setConfirmarLimpieza(true)
                  }}
                >
                  Limpiar historial
                </button>
              </div>

              <ol className="history-list">
                {historial.map((entrada) => (
                  <li className="history-item" key={`${entrada.id}-${entrada.fechaVista}`}>
                    <Link className="history-item__title" to={`/views/${entrada.id}`}>
                      {entrada.titulo}
                    </Link>
                    <span className="badge badge--category">{entrada.categoria}</span>
                    <time className="history-item__date" dateTime={entrada.fechaVista}>
                      {formatDateTime(entrada.fechaVista)}
                    </time>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmarLimpieza}
        titulo="Limpiar historial"
        mensaje="Se borraran las entradas guardadas en este navegador. Las publicaciones no se ven afectadas."
        confirmLabel="Limpiar"
        danger
        onConfirm={limpiarHistorial}
        onClose={() => {
          setConfirmarLimpieza(false)
        }}
      />
    </div>
  )
}
