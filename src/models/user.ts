/**
 * Entidad Usuario del API (seccion 2.1 del enunciado).
 * Los literales de rol y estado se modelan como uniones de string en lugar de
 * `enum` porque el proyecto compila con `erasableSyntaxOnly`, que prohibe las
 * construcciones de TypeScript que emiten codigo en tiempo de ejecucion.
 */
export type UserRole = 'user' | 'superadmin'
export type UserStatus = 'activo' | 'baneado'

export interface User {
  id: string
  nombre: string
  email: string
  rol: UserRole
  estado: UserStatus
  fechaRegistro: string
}

/** Referencia ligera al autor tal como viene embebida en una publicacion. */
export interface AuthorRef {
  id: string
  nombre: string
}

/** Perfil publico de un autor — GET /authors/:id */
export interface AuthorProfile extends AuthorRef {
  fechaRegistro: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  nombre: string
  email: string
  password: string
}

/** Respuesta de POST /auth/login segun el enunciado: { token, usuario }. */
export interface AuthResponse {
  token: string
  usuario: User
}

/** Lo que se persiste en la clave `lasdoscaras_auth`. */
export interface AuthSession {
  token: string
  usuario: User
}
