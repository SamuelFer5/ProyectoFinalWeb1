import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { authService } from '../services/auth.service'
import { favoritesService } from '../services/favorites.service'
import { setUnauthorizedHandler } from '../services/http'
import { CACHE_KEYS, cacheService } from '../services/cache.service'
import { useToast } from '../hooks/useToast'
import { AuthContext } from './auth-context'
import type {
  AuthSession,
  LoginPayload,
  RegisterPayload,
  User,
} from '../models'

/**
 * Estado de autenticacion centralizado (seccion 3.3 del enunciado).
 *
 * Se implementa con `useReducer` en lugar de varios `useState` sueltos porque
 * token, usuario y bandera de restauracion cambian siempre en bloque: un login
 * los fija los tres a la vez y un 401 los limpia los tres a la vez. Tenerlos en
 * transiciones atomicas evita renders con la sesion a medias.
 */

interface AuthState {
  user: User | null
  token: string | null
  isRestoring: boolean
}

type AuthAction =
  | { type: 'restored'; session: AuthSession | null }
  | { type: 'authenticated'; session: AuthSession }
  | { type: 'cleared' }

/**
 * El estado previo no se consulta en ninguna transicion: cada accion describe
 * por completo la sesion resultante. Se nombra `_state` para dejar explicito
 * que la omision es intencional y no un descuido.
 */
function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'restored':
      return {
        user: action.session?.usuario ?? null,
        token: action.session?.token ?? null,
        isRestoring: false,
      }
    case 'authenticated':
      return {
        user: action.session.usuario,
        token: action.session.token,
        isRestoring: false,
      }
    case 'cleared':
      return { user: null, token: null, isRestoring: false }
  }
}

const INITIAL_STATE: AuthState = { user: null, token: null, isRestoring: true }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE)
  const toast = useToast()

  /** Persiste la sesion y arrastra consigo los favoritos del usuario. */
  const persistSession = useCallback(async (session: AuthSession) => {
    cacheService.set<AuthSession>(CACHE_KEYS.auth, session)
    dispatch({ type: 'authenticated', session })

    // El enunciado pide cargar los favoritos inmediatamente tras el login para
    // que el icono de corazon sea correcto desde el primer render del tablero.
    try {
      await favoritesService.sync()
    } catch (error) {
      // Un fallo aqui no debe impedir entrar: el tablero simplemente mostrara
      // los favoritos del cache anterior hasta la proxima sincronizacion.
      console.warn('[auth] No se pudieron sincronizar los favoritos', error)
    }
  }, [])

  const logout = useCallback(() => {
    cacheService.clearSession()
    dispatch({ type: 'cleared' })
  }, [])

  // --- Restauracion de la sesion al arrancar --------------------------------
  useEffect(() => {
    const session = cacheService.get<AuthSession>(CACHE_KEYS.auth)

    if (!session?.token) {
      dispatch({ type: 'restored', session: null })
      return
    }

    // Se pinta la sesion guardada de inmediato y se revalida contra el API.
    // Si el token ya no sirve, el interceptor de 401 la desmontara solo.
    dispatch({ type: 'restored', session })

    const controller = new AbortController()
    authService
      .me(controller.signal)
      .then((user) => {
        cacheService.set<AuthSession>(CACHE_KEYS.auth, { token: session.token, usuario: user })
        dispatch({ type: 'authenticated', session: { token: session.token, usuario: user } })
      })
      .catch(() => {
        // Silencioso a proposito: si fue un 401 ya se manejo globalmente, y si
        // fue un fallo de red la sesion cacheada sigue siendo utilizable.
      })

    return () => {
      controller.abort()
    }
  }, [])

  // --- Interceptor global de 401 --------------------------------------------
  useEffect(() => {
    setUnauthorizedHandler(() => {
      dispatch({ type: 'cleared' })
      toast.warning('Su sesion ha expirado.')
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [toast])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { token, usuario } = await authService.login(payload)
      await persistSession({ token, usuario })
    },
    [persistSession],
  )

  /**
   * Alta de cuenta en los tres pasos que impone el API.
   *
   * `POST /auth/register` NO devuelve token: crea la cuenta en estado PENDING
   * y entrega un `activationToken`. Si no se activa, `POST /auth/login`
   * responde 403 "Account is pending activation" y el usuario recien
   * registrado no puede entrar. Como el API no manda correos y expone el token
   * en la propia respuesta, el cliente encadena registro -> activacion ->
   * login, de modo que el usuario termina el formulario ya autenticado.
   */
  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { activationToken } = await authService.register(payload)

      await authService.activate(activationToken)

      const { token, usuario } = await authService.login({
        email: payload.email,
        password: payload.password,
      })

      await persistSession({ token, usuario })
    },
    [persistSession],
  )

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: state.token !== null && state.user !== null,
      isSuperadmin: state.user?.rol === 'superadmin',
      isRestoring: state.isRestoring,
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
