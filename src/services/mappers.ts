/**
 * Frontera de traduccion entre el REST API y el modelo de dominio.
 *
 * El API (doscarasapi) es un insumo fijo del proyecto: no se puede modificar.
 * Su modelo esta en ingles y sigue la forma de Prisma — `sides: [{ type:
 * 'SIDE' | 'COUNTERPART' }]`, `likeCount`, `category.name`, borrado logico con
 * `deletedAt`. El enunciado, en cambio, describe el dominio en espanol y con
 * `ladoA` / `ladoB` explicitos.
 *
 * Todas las funciones de este archivo van en una sola direccion (DTO -> modelo)
 * salvo las marcadas como `to*Dto`, que preparan los cuerpos de las peticiones
 * de escritura. Fuera de `services/`, nadie mas conoce los DTOs.
 */

import type {
  AuthorDto,
  AuthorRefDto,
  CategoryDto,
  CommentDto,
  HashtagDto,
  PoliticalViewDto,
  ReactionTypeDto,
  SourceDto,
  SourceTypeDto,
  ThreadDto,
  UserDto,
  ViewSideDto,
} from '../models/dto'
import type {
  AuthorProfile,
  AuthorRef,
  Category,
  Comment,
  Hashtag,
  Reaction,
  Side,
  Source,
  SourceType,
  Thread,
  User,
  UserRole,
  UserStatus,
  View,
} from '../models'

// --- Usuarios -----------------------------------------------------------------

const ROLES: Record<string, UserRole> = {
  USER: 'user',
  SUPERADMIN: 'superadmin',
}

const STATUSES: Record<string, UserStatus> = {
  ACTIVE: 'activo',
  SUSPENDED: 'baneado',
  PENDING: 'pendiente',
}

export function toUser(dto: UserDto): User {
  return {
    id: dto.id,
    nombre: dto.name,
    email: dto.email,
    rol: ROLES[dto.role] ?? 'user',
    estado: STATUSES[dto.status] ?? 'activo',
    fechaRegistro: dto.createdAt,
  }
}

export function toAuthorRef(dto: AuthorRefDto): AuthorRef {
  return { id: dto.id, nombre: dto.name }
}

export function toAuthorProfile(dto: AuthorDto): AuthorProfile {
  return {
    id: dto.id,
    nombre: dto.name,
    fechaRegistro: dto.createdAt,
    totalPublicaciones: dto.publishedViewsCount,
  }
}

// --- Catalogos ----------------------------------------------------------------

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    nombre: dto.name,
    // El API no guarda descripcion de categoria; se deja vacia a proposito.
    descripcion: '',
    activo: dto.deletedAt === null,
  }
}

export function toHashtag(dto: HashtagDto): Hashtag {
  return { id: dto.id, nombre: dto.name }
}

// --- Publicaciones ------------------------------------------------------------

const SOURCE_TYPES: Record<SourceTypeDto, SourceType> = {
  LINK: 'enlace',
  YOUTUBE: 'youtube',
  DOCUMENT: 'documento',
}

/** Inverso de `SOURCE_TYPES`, para los formularios de creacion y edicion. */
const SOURCE_TYPES_DTO: Record<SourceType, SourceTypeDto> = {
  enlace: 'LINK',
  youtube: 'YOUTUBE',
  documento: 'DOCUMENT',
}

export function toSourceTypeDto(tipo: SourceType): SourceTypeDto {
  return SOURCE_TYPES_DTO[tipo]
}

function toSource(dto: SourceDto): Source {
  return {
    id: dto.id,
    tipo: SOURCE_TYPES[dto.type] ?? 'enlace',
    url: dto.url,
    // `label` es opcional en el API; sin el, la URL es el mejor rotulo posible.
    titulo: dto.label ?? dto.url,
  }
}

export function toReaction(dto: ReactionTypeDto | null | undefined): Reaction | null {
  if (dto === 'LIKE') return 'like'
  if (dto === 'DISLIKE') return 'dislike'
  return null
}

/**
 * Convierte una cara del API.
 *
 * Los contadores llegan como opcionales porque /search devuelve las caras
 * recortadas (solo `type` y `title`); en ese caso se asume cero en lugar de
 * romper el render.
 */
function toSide(dto: ViewSideDto): Side {
  return {
    id: dto.id,
    titulo: dto.title,
    descripcion: dto.description ?? '',
    likes: dto.likeCount ?? 0,
    dislikes: dto.dislikeCount ?? 0,
    fuentes: (dto.sources ?? []).map(toSource),
    miReaccion: toReaction(dto.myReaction),
  }
}

/** Cara vacia, para publicaciones mal formadas que solo traen un lado. */
function emptySide(id: string, titulo: string): Side {
  return {
    id,
    titulo,
    descripcion: '',
    likes: 0,
    dislikes: 0,
    fuentes: [],
    miReaccion: null,
  }
}

export function toView(dto: PoliticalViewDto): View {
  const sides = dto.sides ?? []
  const sideA = sides.find((side) => side.type === 'SIDE')
  const sideB = sides.find((side) => side.type === 'COUNTERPART')

  const ladoA = sideA ? toSide(sideA) : emptySide(`${dto.id}-a`, 'Postura')
  const ladoB = sideB ? toSide(sideB) : emptySide(`${dto.id}-b`, 'Contrapostura')

  return {
    id: dto.id,
    // El API no tiene titulo a nivel de publicacion: se toma el de la Postura.
    titulo: ladoA.titulo,
    descripcion: ladoA.descripcion,
    autor: toAuthorRef(dto.author),
    ladoA,
    ladoB,
    categoria: toCategory(dto.category),
    hashtags: (dto.hashtags ?? []).map(toHashtag),
    publicado: dto.status === 'PUBLISHED',
    fechaCreacion: dto.createdAt,
    esFavorita: dto.isFavorite ?? false,
    totalHilos: dto._count?.threads ?? 0,
  }
}

// --- Hilos y comentarios ------------------------------------------------------

function toComment(dto: CommentDto): Comment {
  return {
    id: dto.id,
    texto: dto.content,
    autor: toAuthorRef(dto.user),
    hiloId: dto.threadId,
    fechaCreacion: dto.createdAt,
    // El API no expone estado de moderacion: todo comentario nace publicado.
    moderado: true,
    respuestas: (dto.replies ?? []).map(toComment),
  }
}

export { toComment }

export function toThread(dto: ThreadDto): Thread {
  const comentarios = (dto.comments ?? []).map(toComment)

  return {
    id: dto.id,
    // `title` es opcional en el API; el primer comentario da el mejor titular.
    tema: dto.title ?? comentarios[0]?.texto.slice(0, 80) ?? 'Hilo de discusion',
    vistaId: dto.politicalViewId,
    fechaCreacion: dto.createdAt,
    comentarios,
  }
}
