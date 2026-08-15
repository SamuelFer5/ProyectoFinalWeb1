import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EMPTY_SIDE,
  MIN_DESCRIPCION,
  SideFields,
  type DraftSide,
} from '../components/views/SideFields'
import { HashtagInput } from '../components/views/HashtagInput'
import { ErrorState } from '../components/ui/States'
import { catalogService } from '../services/catalog.service'
import { viewsService, type ViewFormPayload } from '../services/views.service'
import { CACHE_KEYS, cacheService } from '../services/cache.service'
import { useToast } from '../hooks/useToast'
import { toFieldErrors, toUserMessage } from '../utils/errors'
import type { Category, FieldErrors } from '../models'

/** Estado completo del formulario. Es tambien la forma del borrador. */
interface FormState {
  categoriaId: string
  ladoA: DraftSide
  ladoB: DraftSide
  hashtags: string[]
}

const EMPTY_FORM: FormState = {
  categoriaId: '',
  ladoA: { ...EMPTY_SIDE, fuentes: [{ tipo: 'enlace', url: '', titulo: '' }] },
  ladoB: { ...EMPTY_SIDE, fuentes: [{ tipo: 'enlace', url: '', titulo: '' }] },
  hashtags: [],
}

/**
 * Pantalla 5 — Crear / Editar publicacion.
 *
 * La misma pantalla sirve para los dos casos: si la ruta trae `:id` se entra en
 * modo edicion y se cargan los datos actuales antes de renderizar. Duplicar el
 * formulario para editar habria significado mantener dos copias de la misma
 * validacion.
 *
 * El borrador se guarda en `lasdoscaras_draft` solo al crear: en edicion ya
 * existe una version en el servidor y restaurar un borrador ajeno encima de una
 * publicacion real seria destructivo.
 */
export function ViewFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [categorias, setCategorias] = useState<Category[]>(() =>
    catalogService.readStaleCategories(),
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftOffer, setDraftOffer] = useState<FormState | null>(null)

  // --- Categorias del desplegable (cache-first, igual que el tablero) -------
  useEffect(() => {
    const controller = new AbortController()

    catalogService
      .fetchCategories(controller.signal)
      .then(setCategorias)
      .catch(() => {
        // Silencioso: el desplegable sigue sirviendo las categorias cacheadas.
      })

    return () => {
      controller.abort()
    }
  }, [])

  // --- Modo edicion: cargar la publicacion actual ---------------------------
  useEffect(() => {
    if (!isEdit || !id) return

    const controller = new AbortController()
    setIsLoading(true)

    viewsService
      .detail(id, controller.signal)
      .then((view) => {
        const toDraft = (side: typeof view.ladoA): DraftSide => ({
          titulo: side.titulo,
          descripcion: side.descripcion,
          fuentes:
            side.fuentes.length > 0
              ? side.fuentes.map((fuente) => ({
                  tipo: fuente.tipo,
                  url: fuente.url,
                  titulo: fuente.titulo,
                }))
              : [{ tipo: 'enlace', url: '', titulo: '' }],
        })

        setForm({
          categoriaId: view.categoria.id,
          ladoA: toDraft(view.ladoA),
          ladoB: toDraft(view.ladoB),
          hashtags: view.hashtags.map((hashtag) => hashtag.nombre),
        })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(toUserMessage(cause, 'No se pudo cargar la publicacion.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, isEdit])

  // --- Borrador: ofrecer restaurar al entrar (solo en creacion) -------------
  useEffect(() => {
    if (isEdit) return
    const guardado = cacheService.get<FormState>(CACHE_KEYS.draft)
    if (guardado) setDraftOffer(guardado)
  }, [isEdit])

  // --- Borrador: guardar mientras se escribe --------------------------------
  useEffect(() => {
    if (isEdit || draftOffer) return

    // Un formulario intacto no se guarda: escribiriamos un borrador vacio que
    // luego ofreceriamos restaurar sin sentido.
    const vacio =
      form.categoriaId === '' &&
      form.ladoA.titulo === '' &&
      form.ladoA.descripcion === '' &&
      form.ladoB.titulo === '' &&
      form.ladoB.descripcion === ''

    if (vacio) return

    // Debounce: sin esto se escribiria en localStorage en cada tecla.
    const timer = setTimeout(() => {
      cacheService.set(CACHE_KEYS.draft, form)
    }, 800)

    return () => {
      clearTimeout(timer)
    }
  }, [form, isEdit, draftOffer])

  // --- Validacion en cliente ------------------------------------------------
  function validar(): boolean {
    const errores: FieldErrors = {}

    if (!form.categoriaId) errores.categoriaId = 'Seleccione una categoria.'

    const revisarLado = (lado: DraftSide, prefijo: string) => {
      if (lado.titulo.trim().length === 0) {
        errores[`${prefijo}Titulo`] = 'El titulo es obligatorio.'
      }
      if (lado.descripcion.trim().length < MIN_DESCRIPCION) {
        errores[`${prefijo}Descripcion`] =
          `El argumento debe tener al menos ${MIN_DESCRIPCION} caracteres.`
      }
      if (lado.fuentes.every((fuente) => fuente.url.trim().length === 0)) {
        errores[`${prefijo}Fuentes`] = 'Agregue al menos una fuente con URL.'
      }
    }

    revisarLado(form.ladoA, 'ladoA')
    revisarLado(form.ladoB, 'ladoB')

    setFieldErrors(errores)
    return Object.keys(errores).length === 0
  }

  // --- Envio ----------------------------------------------------------------
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!validar()) {
      setFormError('Revise los campos marcados antes de continuar.')
      return
    }

    // Se descartan las fuentes sin URL: el usuario pudo agregar una fila y
    // dejarla en blanco, y el API rechazaria la peticion entera.
    const limpiarFuentes = (lado: DraftSide) =>
      lado.fuentes
        .filter((fuente) => fuente.url.trim().length > 0)
        .map((fuente) => ({
          tipo: fuente.tipo,
          url: fuente.url.trim(),
          titulo: fuente.titulo.trim(),
        }))

    const payload: ViewFormPayload = {
      categoriaId: form.categoriaId,
      ladoA: {
        titulo: form.ladoA.titulo.trim(),
        descripcion: form.ladoA.descripcion.trim(),
        fuentes: limpiarFuentes(form.ladoA),
      },
      ladoB: {
        titulo: form.ladoB.titulo.trim(),
        descripcion: form.ladoB.descripcion.trim(),
        fuentes: limpiarFuentes(form.ladoB),
      },
      hashtags: form.hashtags,
    }

    setIsSaving(true)

    try {
      const view = isEdit && id
        ? await viewsService.update(id, payload)
        : await viewsService.create(payload)

      // El borrador solo se descarta cuando la publicacion existe de verdad.
      cacheService.remove(CACHE_KEYS.draft)
      toast.success(isEdit ? 'Publicacion actualizada' : 'Publicacion creada')
      navigate(`/views/${view.id}`)
    } catch (cause: unknown) {
      // Los errores por campo del API (400) se pintan inline; el resto arriba.
      setFieldErrors(toFieldErrors(cause))
      setFormError(toUserMessage(cause, 'No se pudo guardar la publicacion.'))
    } finally {
      // En `finally` para que el boton se rehabilite tanto en exito como en error.
      setIsSaving(false)
    }
  }

  if (loadError !== null) {
    return <ErrorState message={loadError} />
  }

  if (isLoading) {
    return <p className="form-page__loading">Cargando publicacion...</p>
  }

  return (
    <div className="form-page">
      <h1>{isEdit ? 'Editar publicacion' : 'Nueva publicacion'}</h1>

      {draftOffer ? (
        <div className="draft-notice" role="status">
          <p>Tiene un borrador sin publicar. ¿Desea restaurarlo?</p>
          <div className="draft-notice__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setForm(draftOffer)
                setDraftOffer(null)
              }}
            >
              Restaurar
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                cacheService.remove(CACHE_KEYS.draft)
                setDraftOffer(null)
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {formError !== null ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className={`field ${fieldErrors.categoriaId ? 'field--invalid' : ''}`}>
          <label className="field__label" htmlFor="categoria">
            Categoria <span className="field__required">*</span>
          </label>
          <select
            id="categoria"
            className="field__input"
            value={form.categoriaId}
            disabled={isSaving}
            aria-invalid={Boolean(fieldErrors.categoriaId)}
            onChange={(event) => {
              setForm({ ...form, categoriaId: event.target.value })
            }}
          >
            <option value="">Seleccione una categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
          {fieldErrors.categoriaId ? (
            <p className="field__error">{fieldErrors.categoriaId}</p>
          ) : null}
        </div>

        <SideFields
          sideKey="a"
          encabezado="Postura"
          valor={form.ladoA}
          disabled={isSaving}
          onChange={(ladoA) => {
            setForm({ ...form, ladoA })
          }}
        />
        {fieldErrors.ladoATitulo ? <p className="field__error">{fieldErrors.ladoATitulo}</p> : null}
        {fieldErrors.ladoADescripcion ? (
          <p className="field__error">{fieldErrors.ladoADescripcion}</p>
        ) : null}
        {fieldErrors.ladoAFuentes ? (
          <p className="field__error">{fieldErrors.ladoAFuentes}</p>
        ) : null}

        <SideFields
          sideKey="b"
          encabezado="Contrapostura"
          valor={form.ladoB}
          disabled={isSaving}
          onChange={(ladoB) => {
            setForm({ ...form, ladoB })
          }}
        />
        {fieldErrors.ladoBTitulo ? <p className="field__error">{fieldErrors.ladoBTitulo}</p> : null}
        {fieldErrors.ladoBDescripcion ? (
          <p className="field__error">{fieldErrors.ladoBDescripcion}</p>
        ) : null}
        {fieldErrors.ladoBFuentes ? (
          <p className="field__error">{fieldErrors.ladoBFuentes}</p>
        ) : null}

        <HashtagInput
          valor={form.hashtags}
          disabled={isSaving}
          onChange={(hashtags) => {
            setForm({ ...form, hashtags })
          }}
        />

        <div className="form-page__actions">
          {/* Deshabilitado durante el envio: es lo que evita el doble submit. */}
          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="spinner" aria-hidden="true" /> Guardando...
              </>
            ) : isEdit ? (
              'Guardar cambios'
            ) : (
              'Publicar'
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={isSaving}
            onClick={() => {
              navigate(-1)
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}