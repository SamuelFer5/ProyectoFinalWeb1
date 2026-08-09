import { Link } from 'react-router-dom'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareButton'
import { excerpt, formatDate } from '../../utils/format'
import type { View } from '../../models'

interface ViewCardProps {
  view: View
  /**
   * Estado inicial del corazon. Lo decide el contenedor porque la fuente de
   * verdad depende del origen de los datos: `view.esFavorita` cuando la lista
   * viene fresca del API con sesion iniciada, y `lasdoscaras_favorites` cuando
   * se esta sirviendo desde el cache.
   */
  favorito: boolean
}

/**
 * Tarjeta de publicacion — el componente reutilizado por el tablero, la pagina
 * de categoria, los resultados de busqueda y el perfil publico de autor.
 *
 * Punto clave del enunciado: los contadores del Lado A y del Lado B se
 * muestran por separado, nunca sumados, porque son magnitudes independientes.
 */
export function ViewCard({ view, favorito }: ViewCardProps) {
  return (
    <article className="card">
      <header className="card__header">
        <span className="badge badge--category">{view.categoria.nombre}</span>
        <div className="card__actions">
          <FavoriteButton viewId={view.id} initialActive={favorito} />
          <ShareButton viewId={view.id} titulo={view.titulo} />
        </div>
      </header>

      <h2 className="card__title">
        <Link to={`/views/${view.id}`}>{view.titulo}</Link>
      </h2>

      <p className="card__excerpt">{excerpt(view.ladoA.descripcion)}</p>

      {view.hashtags.length > 0 ? (
        <ul className="tag-list" aria-label="Hashtags">
          {view.hashtags.map((hashtag) => (
            <li key={hashtag.id}>
              <span className="badge badge--tag">#{hashtag.nombre}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="card__scores">
        <span className="score score--a">
          <span className="score__label">Postura</span>
          <span className="score__value">
            <span aria-hidden="true">👍</span> {view.ladoA.likes}
            <span className="sr-only"> me gusta en el Lado A</span>
          </span>
        </span>
        <span className="score score--b">
          <span className="score__label">Contrapostura</span>
          <span className="score__value">
            <span aria-hidden="true">👍</span> {view.ladoB.likes}
            <span className="sr-only"> me gusta en el Lado B</span>
          </span>
        </span>
      </div>

      <footer className="card__footer">
        {/* El autor es un enlace al perfil publico, requisito explicito. */}
        <Link className="card__author" to={`/authors/${view.autor.id}`}>
          {view.autor.nombre}
        </Link>
        <time dateTime={view.fechaCreacion}>{formatDate(view.fechaCreacion)}</time>
      </footer>
    </article>
  )
}
