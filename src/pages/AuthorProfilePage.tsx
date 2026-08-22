import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ViewCard } from '../components/views/ViewCard'
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/ui/States'
import { authorsService } from '../services/authors.service'
import { viewsService } from '../services/views.service'
import { favoritesService } from '../services/favorites.service'
import { formatDate } from '../utils/format'
import { toUserMessage } from '../utils/errors'
import type { AuthorProfile, View } from '../models'

const PAGE_SIZE = 9

/**
 * Pantalla 11 — Perfil publico de autor.
 *
 * Accesible sin sesion. Se llega desde el enlace del autor en cualquier tarjeta
 * del tablero y desde el encabezado del detalle de publicacion.
 *
 * Las publicaciones no se piden a un endpoint propio: se reutiliza el mismo
 * listado paginado del tablero con el filtro `autorId`, lo que permite usar la
 * misma ViewCard sin variantes y mantener una sola ruta de datos.
 */
export function AuthorProfilePage() {
  const { id = '' } = useParams<{ id: string }>()

  const [author, setAuthor] = useState<AuthorProfile | null>(null)
  const [views, setViews] = useState<View[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => favoritesService.readIds())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    // Las dos peticiones se lanzan en paralelo: son independientes y esperar
    // una para empezar la otra solo duplicaria el tiempo de carga.
    Promise.all([
      authorsService.fetch(id, controller.signal),
      viewsService.list({ autorId: id, page: 1, limit: PAGE_SIZE }, controller.signal),
    ])
      .then(([profile, result]) => {
        setAuthor(profile)
        setViews(result.data)
        setFavoriteIds(favoritesService.readIds())
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        // El 404 del API ya llega traducido desde http.ts ("Este autor no existe").
        setError(toUserMessage(cause, 'No se pudo cargar el perfil del autor.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [id, reloadToken])

  if (isLoading) {
    return (
      <div className="author-page">
        <CardSkeletonGrid count={PAGE_SIZE} />
      </div>
    )
  }

  if (error !== null) {
    return (
      <div className="author-page">
        <ErrorState
          message={error}
          onRetry={() => {
            setReloadToken((token) => token + 1)
          }}
        />
      </div>
    )
  }

  return (
    <div className="author-page">
      <header className="author-page__header">
        <h1>{author?.nombre ?? 'Autor'}</h1>
        {author ? (
          <p className="author-page__meta">
            En la plataforma desde el {formatDate(author.fechaRegistro)} ·{' '}
            {author.totalPublicaciones === 1
              ? '1 publicacion'
              : `${author.totalPublicaciones} publicaciones`}
          </p>
        ) : null}
      </header>

      {views.length === 0 ? (
        <EmptyState
          title="Este autor todavia no tiene publicaciones"
          hint="Cuando publique algun tema, aparecera aqui."
        />
      ) : (
        <div className="card-grid">
          {views.map((view) => (
            <ViewCard
              key={view.id}
              view={view}
              favorito={view.esFavorita || favoriteIds.includes(view.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}