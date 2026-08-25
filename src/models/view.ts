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
 *
 * En el API cada cara es una fila de `view_sides` con su propio conjunto de
 * `reactions` y de `sources`, asi que la independencia tambien es real en la
 * base de datos, no solo en el cliente.
 */
export interface Side {
  /** ID de la cara en el API. Se conserva para las claves de React. */
  id: string
  titulo: string
  descripcion: string
  likes: number
  dislikes: number
  fuentes: Source[]
  /** Reaccion del usuario autenticado sobre ESTA cara. */
  miReaccion: Reaction | null
}

/**
 * Entidad Publicacion (Tema) — la entidad central de la aplicacion.
 *
 * DECISION DE MAPEO IMPORTANTE: el modelo del API (`PoliticalView`) no tiene
 * campos `title` ni `description` propios; el titulo vive en cada cara. Como el
 * API no se puede modificar, el titulo de la publicacion se deriva del titulo
 * de la Postura (Lado A) y la descripcion de su primer parrafo. Es la unica
 * lectura razonable: la Postura es la tesis que da nombre al debate, y la
 * Contrapostura la responde. Queda documentado tambien en el README.
 */
export interface View {
  id: string
  /** Derivado de `ladoA.titulo` — el API no almacena un titulo por publicacion. */
  titulo: string
  /** Derivado de `ladoA.descripcion`. */
  descripcion: string
  autor: AuthorRef
  ladoA: Side
  ladoB: Side
  categoria: Category
  hashtags: Hashtag[]
  publicado: boolean
  fechaCreacion: string
  /** `true` si la publicacion esta en los favoritos del usuario autenticado. */
  esFavorita: boolean
  /** Cantidad de hilos de comentarios abiertos, cuando el API la informa. */
  totalHilos: number
}

/**
 * Ordenamientos ofrecidos en la UI.
 *
 * `likesA` y `likesB` corresponden a "mas likes Lado A / Lado B" del enunciado.
 * El API solo sabe ordenar por el total de ambas caras (`sort=likes`), asi que
 * el desempate por cara concreta se aplica en el cliente sobre la pagina
 * recibida. Ver `viewsService.list`.
 */
export type SortOption = 'recientes' | 'likesA' | 'likesB'

/** Filtros del tablero. Se persisten en `lasdoscaras_filters`. */
export interface BoardFilters {
  category: string | null
  /**
   * Hashtags activos. El API filtra por UNO solo (`?hashtag=`), asi que la UI
   * mantiene como maximo un elemento; el array se conserva porque es la forma
   * ya persistida en cache y deja la puerta abierta a filtrado multiple si el
   * API llegara a soportarlo.
   */
  hashtags: string[]
  sort: SortOption
}

export interface ViewQuery extends Partial<BoardFilters> {
  page?: number
  limit?: number
  /** `?autorId=` — publicaciones de un autor concreto (perfil publico). */
  autorId?: string
  /** `?autor=me` — publicaciones propias. Requiere JWT. */
  soloMias?: boolean
  /**
   * Impide que la consulta sobrescriba la instantanea del tablero
   * (`lasdoscaras_board`). Lo usan las consultas que no representan lo que
   * el usuario esta viendo — por ejemplo el conteo por categoria del panel
   * de superadmin, que pide `limit=1` y dejaria el modo sin conexion con una
   * sola tarjeta ajena en vez del ultimo tablero real.
   */
  skipSnapshot?: boolean
}

/** Entrada de `lasdoscaras_history` (maximo 20, cola FIFO). */
export interface HistoryEntry {
  id: string
  titulo: string
  categoria: string
  fechaVista: string
}

