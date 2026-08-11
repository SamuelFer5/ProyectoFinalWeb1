import { useId, useState } from 'react'
import type { BoardFilters, Category, Hashtag, SortOption } from '../../models'

interface FilterPanelProps {
  filters: BoardFilters
  categories: Category[]
  hashtags: Hashtag[]
  onChange: (next: BoardFilters) => void
  /** La pagina de categoria fija la categoria y oculta ese selector. */
  hideCategory?: boolean
}

const SORT_LABELS: Record<SortOption, string> = {
  recientes: 'Mas recientes',
  likesA: 'Mas likes en la Postura (Lado A)',
  likesB: 'Mas likes en la Contrapostura (Lado B)',
}

/**
 * Panel de filtros del tablero: categoria, hashtags como chips y ordenamiento.
 *
 * No guarda estado propio del filtro — lo eleva al contenedor, que es quien
 * sincroniza con la URL y con `lasdoscaras_filters`. Aqui solo vive el borrador
 * del input de hashtag, que es estado puramente visual.
 */
export function FilterPanel({
  filters,
  categories,
  hashtags,
  onChange,
  hideCategory = false,
}: FilterPanelProps) {
  const [hashtagDraft, setHashtagDraft] = useState('')
  const categoryId = useId()
  const sortId = useId()
  const hashtagId = useId()
  const listId = useId()

  /**
   * El API filtra por UN hashtag por consulta (`GET /views?hashtag=`), no por
   * una lista. En vez de acumular chips que el servidor ignoraria, el filtro
   * activo se reemplaza. La normalizacion (minusculas, sin `#`) replica la de
   * `normalizeHashtag` del backend para que el termino coincida.
   */
  const addHashtag = (raw: string) => {
    const name = raw.trim().replace(/^#/, '').toLowerCase()
    setHashtagDraft('')

    if (!name || filters.hashtags[0] === name) return
    onChange({ ...filters, hashtags: [name] })
  }

  const removeHashtag = (name: string) => {
    onChange({ ...filters, hashtags: filters.hashtags.filter((item) => item !== name) })
  }

  const hasActiveFilters =
    filters.category !== null || filters.hashtags.length > 0 || filters.sort !== 'recientes'

  return (
    <aside className="filters" aria-label="Filtros de publicaciones">
      {!hideCategory ? (
        <div className="field">
          <label className="field__label" htmlFor={categoryId}>
            Categoria
          </label>
          <select
            id={categoryId}
            className="field__input"
            value={filters.category ?? ''}
            onChange={(event) => {
              onChange({ ...filters, category: event.target.value || null })
            }}
          >
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor={hashtagId}>
          Hashtag
        </label>
        <input
          id={hashtagId}
          className="field__input"
          type="text"
          list={listId}
          placeholder="Escriba y presione Enter"
          value={hashtagDraft}
          onChange={(event) => {
            setHashtagDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addHashtag(hashtagDraft)
            }
          }}
        />
        {/* Sugerencias tomadas del catalogo cacheado, sin llamada extra. */}
        <datalist id={listId}>
          {hashtags.map((hashtag) => (
            <option key={hashtag.id} value={hashtag.nombre} />
          ))}
        </datalist>

        {filters.hashtags.length > 0 ? (
          <ul className="chip-list" aria-label="Hashtags activos">
            {filters.hashtags.map((name) => (
              <li key={name}>
                <span className="chip">
                  #{name}
                  <button
                    type="button"
                    className="chip__remove"
                    onClick={() => {
                      removeHashtag(name)
                    }}
                    aria-label={`Quitar el hashtag ${name}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={sortId}>
          Ordenar por
        </label>
        <select
          id={sortId}
          className="field__input"
          value={filters.sort}
          onChange={(event) => {
            onChange({ ...filters, sort: event.target.value as SortOption })
          }}
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            onChange({ category: null, hashtags: [], sort: 'recientes' })
          }}
        >
          Limpiar filtros
        </button>
      ) : null}
    </aside>
  )
}
