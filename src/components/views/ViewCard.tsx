import { Link } from 'react-router-dom'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareButton'
import { Highlight } from '../ui/Highlight'
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
  /**
   * Oculta el extracto y los contadores de reacciones.
   *
   * `GET /search` devuelve las caras recortadas (solo `type` y `title`), sin
   * descripcion ni contadores. Mostrarlos igual pintaria un parrafo vacio y
   * dos ceros que no son el dato real, asi que la tarjeta se degrada en vez de
   * mentir. Se resuelve con una variante y no con un componente nuevo para no
   * duplicar el resto del marcado.
   */
  compacta?: boolean
  /** Termino a resaltar en el titulo, en la pantalla de resultados. */
  resaltar?: string
  /**
   * Se propaga al boton de favorito. Lo usa la seccion "Mis Favoritos" del
   * perfil para retirar la tarjeta cuando deja de ser favorita.
   */
  onFavoriteChange?: (esFavorito: boolean) => void
}

/**
 * Tarjeta de publicacion — el componente reutilizado por el tablero, la pagina
 * de categoria, los resultados de busqueda y el perfil publico de autor.
 *
 * Punto clave del enunciado: los contadores del Lado A y del Lado B se
 * muestran por separado, nunca sumados, porque son magnitudes independientes.
 */
export function ViewCard({
  view,
  favorito,
  compacta = false,
  resaltar,
  onFavoriteChange,
}: ViewCardProps) {
  return (
    <article className="card">
      <header className="card__header">
        <span className="badge badge--category">{view.categoria.nombre}</span>
        <div className="card__actions">
          <FavoriteButton
            viewId={view.id}
            initialActive={favorito}
            onChange={onFavoriteChange}
          />
          <ShareButton viewId={view.id} titulo={view.titulo} />
        </div>
      </header>

      <h2 className="card__title">
        <Link to={`/views/${view.id}`}>
          <Highlight text={view.titulo} term={resaltar} />
        </Link>
      </h2>

      {!compacta ? <p className="card__excerpt">{excerpt(view.ladoA.descripcion)}</p> : null}

      {view.hashtags.length > 0 ? (
        <ul className="tag-list" aria-label="Hashtags">
          {view.hashtags.map((hashtag) => (
            <li key={hashtag.id}>
              <span className="badge badge--tag">#{hashtag.nombre}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!compacta ? (
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
      ) : null}

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