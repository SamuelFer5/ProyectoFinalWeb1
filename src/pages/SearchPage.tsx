import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { useDebounce } from '../hooks/useDebounce'
import { toUserMessage } from '../utils/errors'
import type { View } from '../models'

/**
 * Pantalla 13 — Resultados de busqueda.
 *
 * El termino vive en la URL (`?q=`) y no en el estado del componente: asi el
 * resultado es compartible, recargable y el boton Atras del navegador
 * funciona. Es el mismo criterio que sigue el tablero con sus filtros.
 *
 * El campo de esta pantalla es el de refinamiento que pide el enunciado; la
 * navbar tiene el suyo propio y ya navega hasta aqui con debounce.
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const term = searchParams.get('q') ?? ''

  // Estado local del input: el usuario escribe libremente y solo despues del
  // debounce se escribe la URL, que es lo que dispara la llamada al API.
  const [draft, setDraft] = useState(term)
  const debouncedDraft = useDebounce(draft, 300)

  const [views, setViews] = useState<View[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => favoritesService.readIds())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Llegar por un enlace externo o cambiar el termino desde la navbar debe
  // reflejarse en el campo de refinamiento.
  useEffect(() => {
    setDraft(term)
  }, [term])

  // El refinamiento reescribe la URL. `replace` evita ensuciar el historial con
  // una entrada por cada pulsacion ya consolidada.
  useEffect(() => {
    const trimmed = debouncedDraft.trim()
    if (trimmed === term) return

    setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true })
  }, [debouncedDraft, term, setSearchParams])

  // --- Carga de resultados --------------------------------------------------
  useEffect(() => {
    const trimmed = term.trim()

    // El API responde 400 si `q` viene vacio: no tiene sentido preguntarle.
    if (trimmed.length === 0) {
      setViews([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    viewsService
      .search(trimmed, controller.signal)
      .then((result) => {
        setViews(result)
        setFavoriteIds(favoritesService.readIds())
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(toUserMessage(cause, 'No se pudo completar la busqueda.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [term, reloadToken])

  const trimmedTerm = term.trim()

  return (
    <div className="search-page">
      <header className="search-page__header">
        <h1>
          {trimmedTerm ? <>Resultados para: &laquo;{trimmedTerm}&raquo;</> : 'Buscar publicaciones'}
        </h1>
        {trimmedTerm && !isLoading && error === null ? (
          <p className="search-page__count">
            {views.length === 1 ? '1 resultado' : `${views.length} resultados`}
          </p>
        ) : null}
      </header>

      <div className="search-page__refine">
        <label className="sr-only" htmlFor="refine-search">
          Refinar la busqueda
        </label>
        <input
          id="refine-search"
          type="search"
          value={draft}
          placeholder="Refinar la busqueda..."
          onChange={(event) => {
            setDraft(event.target.value)
          }}
        />
      </div>

      {isLoading ? (
        <CardSkeletonGrid count={6} />
      ) : error !== null ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setReloadToken((token) => token + 1)
          }}
        />
      ) : trimmedTerm.length === 0 ? (
        <EmptyState
          title="Escriba un termino para buscar"
          hint="Puede buscar por titulo, contenido, categoria o hashtag."
        />
      ) : views.length === 0 ? (
        <EmptyState
          title={`No se encontraron publicaciones para "${trimmedTerm}"`}
          hint="Pruebe con menos palabras o con un termino mas general."
        />
      ) : (
        <div className="card-grid">
          {views.map((view) => (
            <ViewCard
              key={view.id}
              view={view}
              // `/search` no devuelve `isFavorite`: el unico dato disponible es
              // la lista local de IDs de `lasdoscaras_favorites`.
              favorito={favoriteIds.includes(view.id)}
              compacta
              resaltar={trimmedTerm}
            />
          ))}
        </div>
      )}
    </div>
  )
}