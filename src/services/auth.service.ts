import { http } from './http'
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
} from '../models'

/** Endpoints de autenticacion (pantallas 2 y 3 del enunciado). */
export const authService = {
  /** POST /auth/login — devuelve { token, usuario }. */
  login: (payload: LoginPayload): Promise<AuthResponse> =>
    http.post<AuthResponse>('/auth/login', payload, { auth: false }),

  /**
   * POST /auth/register.
   * El API puede responder con la sesion ya iniciada o solo con el usuario
   * creado; el contexto de autenticacion contempla ambos casos.
   */
  register: (payload: RegisterPayload): Promise<Partial<AuthResponse>> =>
    http.post<Partial<AuthResponse>>('/auth/register', payload, { auth: false }),

  /** GET /auth/me — revalida el token guardado al arrancar la aplicacion. */
  me: (signal?: AbortSignal): Promise<User> => http.get<User>('/auth/me', { signal }),
}
