import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { ConfirmDialog } from '../../components/ui/Modal'
import { adminService } from '../../services/admin.service'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useDebounce } from '../../hooks/useDebounce'
import { formatDate } from '../../utils/format'
import { toUserMessage } from '../../utils/errors'
import type { User, UserStatus } from '../../models'

const PAGE_SIZE = 20

const ROL_LABEL: Record<string, string> = {
  user: 'Usuario',
  superadmin: 'Superadministrador',
}

/**
 * El enunciado contempla dos estados (activo / baneado) pero el API maneja
 * tres: toda cuenta nace PENDING hasta que se activa. Se muestra el tercero en
 * ambar en vez de forzarlo a uno de los dos, porque un superadmin necesita
 * distinguir "nunca activo la cuenta" de "lo banearon".
 */
const ESTADO: Record<UserStatus, { label: string; clase: string }> = {
  activo: { label: 'Activo', clase: 'badge--success' },
  baneado: { label: 'Baneado', clase: 'badge--error' },
  pendiente: { label: 'Pendiente', clase: 'badge--warning' },
}

/**
 * Pantalla 7 — Panel de superadmin: gestion de usuarios.
 *
 * La ruta ya esta protegida por `RequireSuperadmin`, pero el 403 del API se
 * maneja igual: el rol pudo cambiar despues de emitirse el token que el cliente
 * tiene guardado.
 */
export function AdminUsersPage() {
  const { user: usuarioActual } = useAuth()
  const toast = useToast()

  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1') || 1

  const [draft, setDraft] = useState(search)
  const debounced = useDebounce(draft, 300)

  const [usuarios, setUsuarios] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  /** Usuario sobre el que se pidio confirmacion; `null` = dialogo cerrado. */
  const [objetivo, setObjetivo] = useState<User | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // --- Busqueda con debounce ------------------------------------------------
  // El termino se refleja en la URL para que el listado filtrado sea
  // compartible y sobreviva a una recarga, igual que en el tablero. Se
  // construye un URLSearchParams nuevo a proposito: cambiar la busqueda debe
  // volver a la pagina 1, porque el conjunto de resultados es otro.
  useEffect(() => {
    const limpio = debounced.trim()
    if (limpio === search) return

    const params = new URLSearchParams()
    if (limpio) params.set('q', limpio)
    setSearchParams(params, { replace: true })
  }, [debounced, search, setSearchParams])

  // --- Carga del listado ----------------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    adminService
      .listUsers({ page, limit: PAGE_SIZE, search: search || undefined }, controller.signal)
      .then((resultado) => {
        setUsuarios(resultado.data)
        setTotal(resultado.total)
        setTotalPages(Math.max(resultado.totalPages, 1))
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(toUserMessage(cause, 'No se pudo cargar la lista de usuarios.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [search, page, reloadToken])

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
   * Ejecuta el baneo o el desbaneo y parchea la fila en el sitio.
   *
   * No se recarga el listado entero: el enunciado pide que la tabla refleje el
   * cambio sin recargar, y el API ya devuelve el usuario actualizado.
   */
  const confirmar = useCallback(async () => {
    if (objetivo === null || isSaving) return

    const baneando = objetivo.estado !== 'baneado'

    setIsSaving(true)
    try {
      const actualizado = baneando
        ? await adminService.banUser(objetivo.id)
        : await adminService.unbanUser(objetivo.id)

      setUsuarios((actuales) =>
        actuales.map((item) => (item.id === actualizado.id ? actualizado : item)),
      )
      toast.success(
        baneando
          ? `${actualizado.nombre} fue baneado`
          : `${actualizado.nombre} fue reactivado`,
      )
      setObjetivo(null)
    } catch (cause) {
      toast.error(toUserMessage(cause, 'No se pudo cambiar el estado del usuario.'))
      setObjetivo(null)
    } finally {
      setIsSaving(false)
    }
  }, [objetivo, isSaving, toast])

  const baneando = objetivo !== null && objetivo.estado !== 'baneado'

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Gestion de usuarios</h1>
          <p className="admin-page__count">
            {isLoading
              ? 'Cargando...'
              : total === 1
                ? '1 usuario registrado'
                : `${total} usuarios registrados`}
          </p>
        </div>

        <div className="field admin-page__search">
          <label className="field__label" htmlFor="buscar-usuario">
            Buscar por nombre o correo
          </label>
          <input
            id="buscar-usuario"
            className="field__input"
            type="search"
            placeholder="Escriba un nombre o correo..."
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
          />
        </div>
      </header>

      {isLoading ? (
        <div className="page-center">
          <Spinner label="Cargando usuarios" />
        </div>
      ) : error !== null ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setReloadToken((token) => token + 1)
          }}
        />
      ) : usuarios.length === 0 ? (
        <EmptyState
          title={
            search
              ? `No hay usuarios que coincidan con "${search}"`
              : 'Todavia no hay usuarios registrados'
          }
          hint={
            search
              ? 'Pruebe con un nombre parcial o con el dominio del correo.'
              : 'Cuando alguien cree una cuenta, aparecera en esta tabla.'
          }
        />
      ) : (
        <>
          {/* El contenedor desplaza la tabla en horizontal en pantallas
              estrechas; el cuerpo de la pagina nunca desborda. */}
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">
                Usuarios registrados, con su rol, estado y acciones de moderacion
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((item) => {
                  const esUnoMismo = item.id === usuarioActual?.id
                  const estado = ESTADO[item.estado]

                  return (
                    <tr key={item.id}>
                      <th scope="row">{item.nombre}</th>
                      <td>{item.email}</td>
                      <td>{ROL_LABEL[item.rol] ?? item.rol}</td>
                      <td>
                        <span className={`badge ${estado.clase}`}>{estado.label}</span>
                      </td>
                      <td>{formatDate(item.fechaRegistro)}</td>
                      <td>
                        {/*
                          El superadmin no puede banearse a si mismo. Ojo: el
                          API NO lo impide — `banUser` solo comprueba que el
                          usuario exista —, asi que este control del cliente es
                          la unica proteccion real. Se oculta el boton en vez de
                          deshabilitarlo, y se explica por que.
                        */}
                        {esUnoMismo ? (
                          <span className="table__hint">Su propia cuenta</span>
                        ) : (
                          <button
                            type="button"
                            className={`btn ${item.estado === 'baneado' ? 'btn--primary' : 'btn--danger'}`}
                            onClick={() => {
                              setObjetivo(item)
                            }}
                          >
                            {item.estado === 'baneado' ? 'Desbanear' : 'Banear'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Paginacion de usuarios">
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
        titulo={baneando ? 'Banear usuario' : 'Reactivar usuario'}
        mensaje={
          baneando
            ? `${objetivo?.nombre ?? ''} no podra iniciar sesion hasta que se le reactive la cuenta. Sus publicaciones no se eliminan.`
            : `${objetivo?.nombre ?? ''} podra volver a iniciar sesion con normalidad.`
        }
        confirmLabel={baneando ? 'Banear' : 'Reactivar'}
        danger={baneando}
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
