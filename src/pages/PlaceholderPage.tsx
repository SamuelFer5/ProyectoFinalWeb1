import { Link } from 'react-router-dom'

interface PlaceholderPageProps {
  /** Numero de pantalla en la seccion 4 del enunciado. */
  pantalla: number
  titulo: string
  /** Ruta del archivo que debe crearse para reemplazar este marcador. */
  archivo: string
  /** Lo que esa pantalla debe hacer, resumido del enunciado. */
  descripcion: string
}

/**
 * Marcador temporal para las pantallas que aun no se han construido.
 *
 * Existe para que el router pueda declarar desde ya las 14 rutas de la seccion
 * 5 del enunciado sin que la navegacion se rompa: la navbar y las tarjetas ya
 * enlazan a varias de estas rutas. Cada marcador dice explicitamente que
 * archivo hay que crear, de modo que sirve de lista de trabajo viva.
 *
 * DEBE desaparecer antes de la entrega final: ninguna ruta puede quedar
 * apuntando aqui el 26 de agosto.
 */
export function PlaceholderPage({
  pantalla,
  titulo,
  archivo,
  descripcion,
}: PlaceholderPageProps) {
  return (
    <div className="placeholder">
      <span className="badge badge--warning">Pendiente de implementar</span>
      <h1>
        Pantalla {pantalla} — {titulo}
      </h1>
      <p className="placeholder__desc">{descripcion}</p>

      <p className="placeholder__file">
        Archivo por crear: <code>{archivo}</code>
      </p>

      <Link className="btn btn--ghost" to="/">
        Volver al tablero
      </Link>
    </div>
  )
}
