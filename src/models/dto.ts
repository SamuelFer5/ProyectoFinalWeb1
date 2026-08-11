/**
 * DTOs — las formas EXACTAS que devuelve el REST API (doscarasapi).
 *
 * Este archivo es deliberadamente feo: replica el modelo de Prisma del backend
 * tal cual, en ingles, con `sides[]` en lugar de `ladoA`/`ladoB` y con los
 * sobres (`{ view }`, `{ views, total, page, limit }`) que usa cada endpoint.
 *
 * La razon de que exista es que el API es un insumo fijo del proyecto y no se
 * puede modificar, mientras que el enunciado describe el dominio en espanol y
 * con otra forma. En vez de contaminar toda la aplicacion con el vocabulario
 * del backend, la frontera se concentra aqui: los DTOs entran, `mappers.ts` los
 * traduce, y de ahi en adelante el resto del codigo solo conoce los modelos de
 * `models/` (View, Side, Category...). Si el API cambia, solo cambian estos dos
 * archivos.
 *
 * NINGUN componente debe importar de aqui.
 */

// --- Usuarios y autenticacion -------------------------------------------------

export type RoleDto = 'USER' | 'SUPERADMIN'
export type UserStatusDto = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export interface UserDto {
  id: string
  email: string
  name: string
  role: RoleDto
  status: UserStatusDto
  createdAt: string
}

/** POST /auth/login */
export interface LoginResponseDto {
  token: string
  user: UserDto
}

/**
 * POST /auth/register.
 *
 * Ojo: NO devuelve token. El API crea la cuenta en estado PENDING y entrega el
 * `activationToken` en la respuesta para que el cliente la active
 * (GET /auth/activate/:token). Sin ese paso, el login responde 403.
 */
export interface RegisterResponseDto {
  user: UserDto
  activationToken: string
}

/** GET /auth/me y GET /auth/activate/:token */
export interface UserWrapperDto {
  user: UserDto
}

// --- Catalogos ----------------------------------------------------------------

export interface CategoryDto {
  id: string
  name: string
  /** Borrado logico: `null` = categoria activa. */
  deletedAt: string | null
}

export interface CategoriesResponseDto {
  categories: CategoryDto[]
}

export interface CategoryResponseDto {
  category: CategoryDto
}

export interface HashtagDto {
  id: string
  name: string
  createdAt?: string
}

export interface HashtagsResponseDto {
  hashtags: HashtagDto[]
}

// --- Publicaciones ------------------------------------------------------------

export interface AuthorRefDto {
  id: string
  name: string
}

export type SourceTypeDto = 'LINK' | 'YOUTUBE' | 'DOCUMENT'

export interface SourceDto {
  id: string
  viewSideId: string
  type: SourceTypeDto
  url: string
  label: string | null
  createdAt: string
}

export type SideTypeDto = 'SIDE' | 'COUNTERPART'
export type ReactionTypeDto = 'LIKE' | 'DISLIKE'

/**
 * Una cara de la publicacion. `SIDE` es el Lado A (Postura) y `COUNTERPART` el
 * Lado B (Contrapostura).
 *
 * Los contadores y `myReaction` son opcionales porque no todos los endpoints
 * los calculan: /search devuelve las caras con solo `type` y `title`.
 */
export interface ViewSideDto {
  id: string
  politicalViewId?: string
  type: SideTypeDto
  title: string
  description?: string
  sources?: SourceDto[]
  likeCount?: number
  dislikeCount?: number
  myReaction?: ReactionTypeDto | null
}

export interface PoliticalViewDto {
  id: string
  categoryId: string
  authorId: string
  status: 'PUBLISHED' | 'UNPUBLISHED'
  createdAt: string
  updatedAt?: string
  category: CategoryDto
  author: AuthorRefDto
  sides: ViewSideDto[]
  hashtags?: HashtagDto[]
  _count?: { threads: number }
  totalLikes?: number
  totalDislikes?: number
  /** Solo viene cuando la peticion viaja con un JWT valido. */
  isFavorite?: boolean
}

/** GET /views y GET /admin/views */
export interface ViewListResponseDto {
  total: number
  page: number
  limit: number
  views: PoliticalViewDto[]
}

/** GET /views/:id, POST /views, PUT /views/:id, PATCH /views/:id/(un)publish */
export interface ViewResponseDto {
  view: PoliticalViewDto
}

/** POST /views/:id/sides/:side/(like|dislike) — devuelve SOLO esa cara. */
export interface ReactionResponseDto {
  likeCount: number
  dislikeCount: number
  myReaction: ReactionTypeDto | null
}

/** POST y DELETE /views/:id/favorite */
export interface FavoriteResponseDto {
  isFavorite: boolean
}

/** GET /users/me/favorites — solo los IDs, no las publicaciones completas. */
export interface MyFavoritesResponseDto {
  favorites: string[]
}

/** GET /search?q= — busqueda global sobre cuatro colecciones a la vez. */
export interface SearchResponseDto {
  views: PoliticalViewDto[]
  categories: CategoryDto[]
  hashtags: HashtagDto[]
  authors: AuthorRefDto[]
}

// --- Autores ------------------------------------------------------------------

export interface AuthorDto {
  id: string
  name: string
  createdAt: string
  publishedViewsCount: number
}

export interface AuthorResponseDto {
  author: AuthorDto
}

// --- Hilos y comentarios ------------------------------------------------------

export interface CommentDto {
  id: string
  threadId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: string
  user: AuthorRefDto
  /** El API modela un unico nivel de respuestas. */
  replies?: CommentDto[]
}

export interface ThreadDto {
  id: string
  politicalViewId: string
  title: string | null
  createdAt: string
  comments: CommentDto[]
}

export interface ThreadsResponseDto {
  threads: ThreadDto[]
}

export interface ThreadResponseDto {
  thread: ThreadDto
}

export interface CommentResponseDto {
  comment: CommentDto
}

// --- Administracion -----------------------------------------------------------

export interface AdminUsersResponseDto {
  total: number
  page: number
  limit: number
  users: UserDto[]
}
