import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/States'

/**
 * Guards de ruta (seccion 5 del enunciado).
 *
 * Los tres esperan a que termine la restauracion de la sesion antes de decidir:
 * sin esa espera, recargar una ruta protegida expulsaria al usuario al login
 * durante el instante en que el token todavia no se ha leido del cache.
 */

function RestoringSession() {
  return (
    <div className="page-center">
      <Spinner label="Restaurando sesion" />
    </div>
  )
}

/** Exige sesion iniciada. Redirige a /login recordando el destino original. */
export function RequireAuth() {
  const { isAuthenticated, isRestoring } = useAuth()
  const location = useLocation()

  if (isRestoring) return <RestoringSession />

  if (!isAuthenticated) {
    // `state.from` permite devolver al usuario a donde queria ir tras el login.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

/**
 * Exige rol de superadministrador. Redirige a /403 y NO a /login: el usuario
 * puede estar perfectamente autenticado, solo que sin el rol necesario.
 */
export function RequireSuperadmin() {
  const { isAuthenticated, isSuperadmin, isRestoring } = useAuth()
  const location = useLocation()

  if (isRestoring) return <RestoringSession />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isSuperadmin) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

/** Solo para no autenticados: quien ya inicio sesion no vuelve al login. */
export function RequireGuest() {
  const { isAuthenticated, isRestoring } = useAuth()

  if (isRestoring) return <RestoringSession />

  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}
