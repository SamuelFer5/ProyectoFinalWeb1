import { useEffect, useState } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { catalogService } from '../../services/catalog.service'

/** Tope que impone el API: maximo 10 hashtags por publicacion. */
export const MAX_HASHTAGS = 10

interface HashtagInputProps {
  valor: string[]
  onChange: (hashtags: string[]) => void
  disabled: boolean
}

/**
 * Campo tipo "tag input": se escribe y con Enter o coma se agrega un chip.
 *
 * Las sugerencias salen de `GET /hashtags?q=` con el mismo debounce de 300 ms
 * de la busqueda global, para no disparar una peticion por tecla. Se usa
 * <datalist> en vez de un desplegable propio porque el navegador ya aporta el
 * comportamiento de teclado y el anuncio a lectores de pantalla.
 */
export function HashtagInput({ valor, onChange, disabled }: HashtagInputProps) {
  const [draft, setDraft] = useState('')
  const debounced = useDebounce(draft, 300)
  const [sugerencias, setSugerencias] = useState<string[]>([])

  useEffect(() => {
    const term = debounced.trim()
    if (term.length < 2) {
      setSugerencias([])
      return
    }

    const controller = new AbortController()

    catalogService
      .searchHashtags(term, controller.signal)
      .then((hashtags) => {
        setSugerencias(hashtags.map((hashtag) => hashtag.nombre))
      })
      .catch(() => {
        // Silencioso: las sugerencias son una ayuda, no un requisito.
      })

    return () => {
      controller.abort()
    }
  }, [debounced])

  const agregar = (texto: string) => {
    // El API guarda los hashtags normalizados en minusculas y sin '#'.
    const limpio = texto.trim().replace(/^#/, '').toLowerCase()
    if (limpio.length === 0) return
    if (valor.includes(limpio)) {
      setDraft('')
      return
    }
    if (valor.length >= MAX_HASHTAGS) return

    onChange([...valor, limpio])
    setDraft('')
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor="hashtags">
        Hashtags
      </label>

      <input
        id="hashtags"
        className="field__input"
        type="text"
        list="hashtag-sugerencias"
        placeholder="Escriba y presione Enter"
        value={draft}
        disabled={disabled || valor.length >= MAX_HASHTAGS}
        aria-describedby="hashtags-hint"
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            // Enter dentro de un formulario haria submit: se intercepta.
            event.preventDefault()
            agregar(draft)
          }
        }}
      />

      <datalist id="hashtag-sugerencias">
        {sugerencias.map((nombre) => (
          <option key={nombre} value={nombre} />
        ))}
      </datalist>

      <p className="field__hint" id="hashtags-hint">
        {valor.length} de {MAX_HASHTAGS}. Presione Enter o coma para agregar.
      </p>

      {valor.length > 0 ? (
        <ul className="chip-list">
          {valor.map((hashtag) => (
            <li key={hashtag}>
              <span className="chip">
                #{hashtag}
                <button
                  type="button"
                  className="chip__remove"
                  aria-label={`Quitar ${hashtag}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(valor.filter((item) => item !== hashtag))
                  }}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}