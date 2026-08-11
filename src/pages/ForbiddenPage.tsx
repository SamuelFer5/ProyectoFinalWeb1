import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Pantalla 12 — Error 403 (acceso denegado).
 *
 * Deliberadamente NO ofrece iniciar sesion como accion principal: el enunciado
 * distingue el 403 del 401 precisamente porque el usuario puede estar
 * autenticado y aun asi carecer del rol necesario.
 */
export function ForbiddenPage() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="error-page">
      <p className="error-page__code" aria-hidden="true">
        403
      </p>
      <h1>Acceso denegado</h1>
      <p className="error-page__hint">
        {isAuthenticated
          ? `Su cuenta (${user?.nombre ?? 'usuario'}) no tiene los permisos necesarios para ver esta seccion.`
          : 'Esta seccion esta reservada para personal autorizado.'}
      </p>
      <Link className="btn btn--primary" to="/">
        Volver al tablero
      </Link>
    </div>
  )
}
