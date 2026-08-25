import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { adminService } from '../../services/admin.service'
import { useToast } from '../../hooks/useToast'
import { isApiError } from '../../models'
import { toUserMessage } from '../../utils/errors'
import type { Category } from '../../models'

/** Estado del formulario modal: crear una nueva, editar una existente, o nada. */
type FormMode = { tipo: 'crear' } | { tipo: 'editar'; categoria: Category } | null

/**
 * Pantalla 8 — Panel de superadmin: gestion de categorias.
 *
 * DOS LIMITACIONES DEL API condicionan esta pantalla, y conviene tenerlas
 * presentes al leerla:
 *
 *   1. `Category` en Prisma es `{ id, name, deletedAt }`. No hay descripcion,
 *      asi que el formulario no la pide: un campo que se escribe y se pierde
 *      seria peor que no tenerlo. La columna se muestra igual, con un guion.
 *
 *   2. La baja es LOGICA y no tiene vuelta atras por API. `softDeleteCategory`
 *      escribe `deletedAt`, y tanto `updateCategory` como `softDeleteCategory`
 *      empiezan por `getActiveCategory`, que responde 404 si la categoria ya
 *      esta dada de baja. No existe endpoint que limpie `deletedAt`: una
 *      categoria inactiva es un estado terminal. Por eso no se ofrece
 *      "Reactivar" — seria un boton que siempre falla.
 */
export function AdminCategoriesPage() {
  const toast = useToast()

  const [categorias, setCategorias] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [form, setForm] = useState<FormMode>(null)
  const [nombre, setNombre] = useState('')
  const [nombreError, setNombreError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [objetivo, setObjetivo] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // --- Carga ----------------------------------------------------------------
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    adminService
      .listCategoriesWithCounts(controller.signal)
      .then(setCategorias)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(toUserMessage(cause, 'No se pudo cargar la lista de categorias.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [reloadToken])

  const abrirCrear = () => {
    setForm({ tipo: 'crear' })
    setNombre('')
    setNombreError(null)
  }

  const abrirEditar = (categoria: Category) => {
    setForm({ tipo: 'editar', categoria })
    setNombre(categoria.nombre)
    setNombreError(null)
  }

  const cerrarForm = () => {
    if (isSaving) return
    setForm(null)
    setNombreError(null)
  }

  /**
   * Validacion en cliente antes de gastar una peticion.
   *
   * El duplicado se comprueba contra la lista ya cargada, pero el API sigue
   * siendo la autoridad: si otro superadmin creo la misma categoria mientras
   * tanto, llega un 409 que se pinta en el mismo campo.
   */
  const validar = (): boolean => {
    const limpio = nombre.trim()

    if (limpio.length === 0) {
      setNombreError('El nombre es obligatorio.')
      return false
    }

    const editandoId = form?.tipo === 'editar' ? form.categoria.id : null
    const duplicada = categorias.some(
      (item) =>
        item.id !== editandoId && item.nombre.toLowerCase() === limpio.toLowerCase(),
    )

    if (duplicada) {
      setNombreError('Ya existe una categoria con ese nombre.')
      return false
    }

    setNombreError(null)
    return true
  }

  /**
   * No se memoriza con `useCallback` a proposito: es el manejador del `submit`
   * de un formulario que se renderiza en este mismo componente, no un prop de
   * un hijo memorizado, asi que memorizarlo no ahorraria ningun render y solo
   * obligaria a mantener una lista de dependencias larga y fragil.
   */
  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form === null || isSaving || !validar()) return

    const limpio = nombre.trim()
    setIsSaving(true)

    try {
      if (form.tipo === 'crear') {
        const creada = await adminService.createCategory(limpio)
        // La categoria nace sin publicaciones: el conteo se conoce sin pedirlo.
        setCategorias((actuales) =>
          [...actuales, { ...creada, totalPublicaciones: 0 }].sort((a, b) =>
            a.nombre.localeCompare(b.nombre),
          ),
        )
        toast.success('Categoria creada')
      } else {
        const actualizada = await adminService.updateCategory(form.categoria.id, limpio)
        setCategorias((actuales) =>
          actuales
            .map((item) =>
              item.id === actualizada.id
                ? { ...actualizada, totalPublicaciones: item.totalPublicaciones }
                : item,
            )
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        )
        toast.success('Categoria actualizada')
      }

      setForm(null)
    } catch (cause) {
      // 409 = nombre duplicado. Va inline en el campo, no en un toast suelto.
      if (isApiError(cause) && cause.status === 409) {
        setNombreError('Ya existe una categoria con ese nombre.')
      } else {
        toast.error(toUserMessage(cause, 'No se pudo guardar la categoria.'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  const eliminar = useCallback(async () => {
    if (objetivo === null || isDeleting) return

    setIsDeleting(true)
    try {
      await adminService.deleteCategory(objetivo.id)

      // Baja logica: la categoria no desaparece de la tabla, pasa a inactiva.
      setCategorias((actuales) =>
        actuales.map((item) =>
          item.id === objetivo.id ? { ...item, activo: false } : item,
        ),
      )
      toast.success('Categoria desactivada')
      setObjetivo(null)
    } catch (cause) {
      toast.error(toUserMessage(cause, 'No se pudo desactivar la categoria.'))
      setObjetivo(null)
    } finally {
      setIsDeleting(false)
    }
  }, [objetivo, isDeleting, toast])

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Gestion de categorias</h1>
          <p className="admin-page__count">
            {isLoading
              ? 'Cargando...'
              : `${categorias.length} categorias · ${categorias.filter((item) => item.activo).length} activas`}
          </p>
        </div>

        <button type="button" className="btn btn--primary" onClick={abrirCrear}>
          Nueva categoria
        </button>
      </header>

      {isLoading ? (
        <div className="page-center">
          <Spinner label="Cargando categorias" />
        </div>
      ) : error !== null ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setReloadToken((token) => token + 1)
          }}
        />
      ) : categorias.length === 0 ? (
        <EmptyState
          title="No hay categorias registradas"
          hint="Cree la primera para que los usuarios puedan clasificar sus publicaciones."
        >
          <button type="button" className="btn btn--primary" onClick={abrirCrear}>
            Nueva categoria
          </button>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">
              Categorias de la plataforma, con su estado y publicaciones asociadas
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Descripcion</th>
                <th scope="col">Publicaciones</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.id}>
                  <th scope="row">{categoria.nombre}</th>
                  <td className="table__hint">
                    {categoria.descripcion || 'No disponible en el API'}
                  </td>
                  <td>{categoria.totalPublicaciones ?? '—'}</td>
                  <td>
                    <span
                      className={`badge ${categoria.activo ? 'badge--success' : 'badge--error'}`}
                    >
                      {categoria.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td>
                    {categoria.activo ? (
                      <div className="table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            abrirEditar(categoria)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => {
                            setObjetivo(categoria)
                          }}
                        >
                          Desactivar
                        </button>
                      </div>
                    ) : (
                      // Una categoria inactiva no admite ninguna operacion: el
                      // API responde 404 a editarla y a volver a eliminarla, y
                      // no expone forma de reactivarla.
                      <span className="table__hint">Sin acciones disponibles</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="admin-page__note">
        El API almacena unicamente el nombre de la categoria, por lo que la descripcion no
        puede editarse. Desactivar una categoria es una baja logica y no se puede deshacer
        desde la aplicacion: las publicaciones asociadas se conservan.
      </p>

      {/* --- Modal de creacion / edicion --------------------------------- */}
      <Modal
        open={form !== null}
        titulo={form?.tipo === 'editar' ? 'Editar categoria' : 'Nueva categoria'}
        onClose={cerrarForm}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={cerrarForm}
              disabled={isSaving}
            >
              Cancelar
            </button>
            {/* `form=` permite que el boton viva en el pie del modal y aun asi
                envie el formulario, conservando el Enter dentro del campo. */}
            <button
              type="submit"
              form="form-categoria"
              className="btn btn--primary"
              disabled={isSaving}
            >
              {isSaving ? <Spinner label="Guardando" /> : null}
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <form
          id="form-categoria"
          onSubmit={(event) => {
            void guardar(event)
          }}
          noValidate
        >
          <div className={`field ${nombreError ? 'field--invalid' : ''}`}>
            <label className="field__label" htmlFor="categoria-nombre">
              Nombre <span className="field__required">*</span>
            </label>
            <input
              id="categoria-nombre"
              className="field__input"
              type="text"
              value={nombre}
              disabled={isSaving}
              aria-invalid={Boolean(nombreError)}
              aria-describedby={nombreError ? 'categoria-nombre-error' : undefined}
              onChange={(event) => {
                setNombre(event.target.value)
                setNombreError(null)
              }}
            />
            {nombreError ? (
              <p className="field__error" id="categoria-nombre-error">
                {nombreError}
              </p>
            ) : null}
          </div>
        </form>
      </Modal>

      {/* --- Confirmacion de baja ---------------------------------------- */}
      <ConfirmDialog
        open={objetivo !== null}
        titulo="Desactivar categoria"
        mensaje={
          objetivo && objetivo.totalPublicaciones && objetivo.totalPublicaciones > 0
            ? `"${objetivo.nombre}" tiene ${objetivo.totalPublicaciones} publicacion(es) asociada(s). Se conservaran, pero la categoria dejara de ofrecerse al crear publicaciones nuevas. Esta accion no se puede deshacer.`
            : `"${objetivo?.nombre ?? ''}" dejara de ofrecerse al crear publicaciones nuevas. Esta accion no se puede deshacer.`
        }
        confirmLabel="Desactivar"
        danger
        busy={isDeleting}
        onConfirm={() => {
          void eliminar()
        }}
        onClose={() => {
          setObjetivo(null)
        }}
      />
    </div>
  )
}
