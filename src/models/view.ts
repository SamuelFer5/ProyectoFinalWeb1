import type { AuthorRef } from './user'
import type { Category } from './category'
import type { Hashtag } from './hashtag'

export type SourceType = 'enlace' | 'youtube' | 'documento'

/** Fuente de referencia adjunta a UNA cara concreta de la publicacion. */
export interface Source {
  id: string
  tipo: SourceType
  url: string
  titulo: string
}

export type Reaction = 'like' | 'dislike'

/** Identifica cual de las dos caras se esta manipulando. */
export type SideKey = 'a' | 'b'

/**
 * Una de las dos caras de un tema (Postura / Contrapostura).
 *
 * Se modela como un tipo propio y NO como campos sueltos dentro de `View`
 * precisamente porque el enunciado exige que los contadores de Lado A y Lado B
 * sean completamente independientes: al compartir la misma forma pero vivir en
 * objetos distintos, es imposible que una reaccion de un lado mute el otro.
 */
export interface Side {
  titulo: string
  descripcion: string
  likes: number
  dislikes: number
  fuentes: Source[]
  /** Reaccion del usuario autenticado sobre ESTA cara, si el API la expone. */
  miReaccion?: Reaction | null
}

/** Entidad Publicacion (Tema) — la entidad central de la aplicacion. */
export interface View {
  id: string
  titulo: string
  descripcion: string
  autor: AuthorRef
  ladoA: Side
  ladoB: Side
  categoria: Category
  hashtags: Hashtag[]
  publicado: boolean
  fechaCreacion: string
}

export type SortOption = 'recientes' | 'likesA' | 'likesB'

/** Filtros del tablero. Se persisten en `lasdoscaras_filters`. */
export interface BoardFilters {
  category: string | null
  hashtags: string[]
  sort: SortOption
}

export interface ViewQuery extends Partial<BoardFilters> {
  page?: number
  limit?: number
  search?: string
  autorId?: string
}

/** Entrada de `lasdoscaras_history` (maximo 20, cola FIFO). */
export interface HistoryEntry {
  id: string
  titulo: string
  categoria: string
  fechaVista: string
}
