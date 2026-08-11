import { Link } from 'react-router-dom'

/**
 * Pantalla 12 — Error 404.
 *
 * Se monta dentro del <Layout>, de modo que conserva la navbar y el pie de
 * pagina, tal como pide el enunciado ("ambas paginas deben mantener la navbar
 * y el layout general de la aplicacion").
 */
export function NotFoundPage() {
  return (
    <div className="error-page">
      <p className="error-page__code" aria-hidden="true">
        404
      </p>
      <h1>Pagina no encontrada</h1>
      <p className="error-page__hint">
        La direccion que intenta abrir no existe o el contenido fue retirado del tablero.
      </p>
      <Link className="btn btn--primary" to="/">
        Volver al tablero
      </Link>
    </div>
  )
}
