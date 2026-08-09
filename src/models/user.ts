/**
 * Entidad Usuario del API (seccion 2.1 del enunciado).
 * Los literales de rol y estado se modelan como uniones de string en lugar de
 * `enum` porque el proyecto compila con `erasableSyntaxOnly`, que prohibe las
 * construcciones de TypeScript que emiten codigo en tiempo de ejecucion.
 */
export type UserRole = 'user' | 'superadmin'

/**
 * El enunciado contempla dos estados (activo / baneado) pero el API maneja
 * tres: ademas de ACTIVE y SUSPENDED existe PENDING, el estado en el que nace
 * toda cuenta recien registrada hasta que se activa. Se expone tal cual porque
 * el login responde 403 con un motivo distinto en cada caso y la UI necesita
 * poder explicarle al usuario cual de los dos le ocurrio.
 */
export type UserStatus = 'activo' | 'baneado' | 'pendiente'

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
  totalPublicaciones: number
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

/** Sesion resultante de POST /auth/login. */
export interface AuthResponse {
  token: string
  usuario: User
}

/** Lo que se persiste en la clave `lasdoscaras_auth`. */
export type AuthSession = AuthResponse
