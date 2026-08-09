/**
 * Punto unico de importacion de los modelos de dominio.
 *
 * Los DTOs del API (`./dto`) NO se reexportan aqui a proposito: solo la capa de
 * servicio debe conocerlos. Si un componente necesita importar de `models/dto`,
 * es senal de que falta un mapper.
 */

export type {
  User,
  UserRole,
  UserStatus,
  AuthorRef,
  AuthorProfile,
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  AuthSession,
} from './user'

export type {
  View,
  Side,
  SideKey,
  Source,
  SourceType,
  Reaction,
  SortOption,
  BoardFilters,
  ViewQuery,
  HistoryEntry,
} from './view'

export type { Category } from './category'
export type { Hashtag } from './hashtag'
export type { Comment, Thread } from './comment'
export type { Paginated, FieldErrors } from './api'
export { ApiError, isApiError } from './api'
