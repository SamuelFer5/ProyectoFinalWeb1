import { http } from './http'
import { toUser } from './mappers'
import type {
  LoginResponseDto,
  RegisterResponseDto,
  UserWrapperDto,
} from '../models/dto'
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '../models'

/**
 * Autenticacion (pantallas 2 y 3 del enunciado).
 *
 * El API entregado tiene un flujo de alta en DOS pasos que conviene tener muy
 * presente:
 *
 *   1. POST /auth/register crea la cuenta en estado PENDING y NO devuelve
 *      token; devuelve `{ user, activationToken }`.
 *   2. GET /auth/activate/:token pasa la cuenta a ACTIVE.
 *
 * Si se omite el paso 2, POST /auth/login responde 403 "Account is pending
 * activation" y el usuario queda encerrado fuera de su propia cuenta recien
 * creada. Como el API no envia correos, entrega el token de activacion en la
 * misma respuesta del registro, y es el cliente quien encadena los dos pasos.
 */
export const authService = {
  /** POST /auth/login — respuesta `{ token, user }`. */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const dto = await http.post<LoginResponseDto>(
      '/auth/login',
      { email: payload.email, password: payload.password },
      { auth: false },
    )

    return { token: dto.token, usuario: toUser(dto.user) }
  },

  /**
   * POST /auth/register — respuesta `{ user, activationToken }`.
   * Devuelve el token de activacion crudo para que el llamador encadene el
   * paso de activacion.
   */
  async register(payload: RegisterPayload): Promise<{ usuario: User; activationToken: string }> {
    const dto = await http.post<RegisterResponseDto>(
      '/auth/register',
      // El API espera `name`, no `nombre`.
      { name: payload.nombre, email: payload.email, password: payload.password },
      { auth: false },
    )

    return { usuario: toUser(dto.user), activationToken: dto.activationToken }
  },

  /** GET /auth/activate/:token — deja la cuenta en estado ACTIVE. */
  async activate(activationToken: string): Promise<User> {
    const dto = await http.get<UserWrapperDto>(
      `/auth/activate/${encodeURIComponent(activationToken)}`,
      { auth: false },
    )

    return toUser(dto.user)
  },

  /** GET /auth/me — revalida el token guardado al arrancar la aplicacion. */
  async me(signal?: AbortSignal): Promise<User> {
    const dto = await http.get<UserWrapperDto>('/auth/me', { signal })
    return toUser(dto.user)
  },
}
