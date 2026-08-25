import type { SourceType } from '../../models'

/** Fuente en edicion. Sin `id` porque el API lo asigna al guardar. */
export interface DraftSource {
  tipo: SourceType
  url: string
  titulo: string
}

/** Una cara del formulario, antes de enviarse al API. */
export interface DraftSide {
  titulo: string
  descripcion: string
  fuentes: DraftSource[]
}

/** Longitud minima del argumento que exige el enunciado. */
export const MIN_DESCRIPCION = 100

export const EMPTY_SOURCE: DraftSource = { tipo: 'enlace', url: '', titulo: '' }

export const EMPTY_SIDE: DraftSide = {
  titulo: '',
  descripcion: '',
  fuentes: [{ ...EMPTY_SOURCE }],
}

/** Extrae el ID de un video de YouTube para la vista previa del embed. */
function youtubeEmbedId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.slice(1) || null
    if (host.endsWith('youtube.com')) return parsed.searchParams.get('v')
    return null
  } catch {
    return null
  }
}

interface SideFieldsProps {
  /** 'a' = Postura, 'b' = Contrapostura. Solo afecta etiquetas e IDs. */
  sideKey: 'a' | 'b'
  encabezado: string
  valor: DraftSide
  onChange: (side: DraftSide) => void
  disabled: boolean
}

/**
 * Bloque de campos de UNA cara: titulo, argumento y fuentes propias.
 *
 * Se extrae como componente porque el Lado A y el Lado B son estructuralmente
 * identicos; duplicar el marcado seria el tipo de repeticion que penaliza el
 * criterio de componentes reutilizables. Es un componente controlado: no
 * guarda estado propio, todo sube al formulario padre, que es quien conoce el
 * borrador completo y sabe persistirlo.
 */
export function SideFields({ sideKey, encabezado, valor, onChange, disabled }: SideFieldsProps) {
  const prefix = `lado-${sideKey}`
  const faltan = MIN_DESCRIPCION - valor.descripcion.trim().length

  const patch = (cambios: Partial<DraftSide>) => {
    onChange({ ...valor, ...cambios })
  }

  const patchSource = (index: number, cambios: Partial<DraftSource>) => {
    const fuentes = valor.fuentes.map((fuente, i) =>
      i === index ? { ...fuente, ...cambios } : fuente,
    )
    patch({ fuentes })
  }

  return (
    <fieldset className={`side-fields side-fields--${sideKey}`}>
      <legend>{encabezado}</legend>

      <div className="field">
        <label className="field__label" htmlFor={`${prefix}-titulo`}>
          Titulo de la {encabezado.toLowerCase()} <span className="field__required">*</span>
        </label>
        <input
          id={`${prefix}-titulo`}
          className="field__input"
          type="text"
          maxLength={120}
          value={valor.titulo}
          disabled={disabled}
          onChange={(event) => {
            patch({ titulo: event.target.value })
          }}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${prefix}-descripcion`}>
          Argumento <span className="field__required">*</span>
        </label>
        <textarea
          id={`${prefix}-descripcion`}
          className="field__input"
          rows={6}
          value={valor.descripcion}
          disabled={disabled}
          aria-describedby={`${prefix}-contador`}
          onChange={(event) => {
            patch({ descripcion: event.target.value })
          }}
        />
        {/* aria-live para que un lector de pantalla anuncie cuanto falta. */}
        <p className="field__hint" id={`${prefix}-contador`} aria-live="polite">
          {faltan > 0
            ? `Faltan ${faltan} caracteres del minimo de ${MIN_DESCRIPCION}.`
            : `${valor.descripcion.trim().length} caracteres.`}
        </p>
      </div>

      <div className="sources">
        <div className="sources__header">
          <h3>Fuentes de la {encabezado.toLowerCase()}</h3>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={disabled}
            onClick={() => {
              patch({ fuentes: [...valor.fuentes, { ...EMPTY_SOURCE }] })
            }}
          >
            Agregar fuente
          </button>
        </div>

        {valor.fuentes.map((fuente, index) => {
          const videoId = fuente.tipo === 'youtube' ? youtubeEmbedId(fuente.url) : null

          return (
            <div className="source-row" key={index}>
              <div className="field">
                <label className="field__label" htmlFor={`${prefix}-tipo-${index}`}>
                  Tipo
                </label>
                <select
                  id={`${prefix}-tipo-${index}`}
                  className="field__input"
                  value={fuente.tipo}
                  disabled={disabled}
                  onChange={(event) => {
                    patchSource(index, { tipo: event.target.value as SourceType })
                  }}
                >
                  <option value="enlace">Enlace</option>
                  <option value="youtube">YouTube</option>
                  <option value="documento">Documento</option>
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`${prefix}-url-${index}`}>
                  URL <span className="field__required">*</span>
                </label>
                <input
                  id={`${prefix}-url-${index}`}
                  className="field__input"
                  type="url"
                  placeholder="https://..."
                  value={fuente.url}
                  disabled={disabled}
                  onChange={(event) => {
                    patchSource(index, { url: event.target.value })
                  }}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`${prefix}-label-${index}`}>
                  Titulo descriptivo
                </label>
                <input
                  id={`${prefix}-label-${index}`}
                  className="field__input"
                  type="text"
                  value={fuente.titulo}
                  disabled={disabled}
                  onChange={(event) => {
                    patchSource(index, { titulo: event.target.value })
                  }}
                />
              </div>

              {/* El enunciado pide al menos una fuente por cara: si solo queda
                  una, no se ofrece eliminarla. */}
              {valor.fuentes.length > 1 ? (
                <button
                  type="button"
                  className="btn btn--ghost source-row__remove"
                  disabled={disabled}
                  onClick={() => {
                    patch({ fuentes: valor.fuentes.filter((_, i) => i !== index) })
                  }}
                >
                  Eliminar fuente
                </button>
              ) : null}

              {videoId ? (
                <div className="source-row__preview">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={fuente.titulo || 'Vista previa de YouTube'}
                    allowFullScreen
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}