import { http, buildQuery } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import { toReaction, toSourceTypeDto, toThread, toView } from './mappers'
import type {
  ReactionResponseDto,
  SearchResponseDto,
  ThreadResponseDto,
  ThreadsResponseDto,
  ViewListResponseDto,
  ViewResponseDto,
} from '../models/dto'
import type {
  Paginated,
  Reaction,
  Side,
  SideKey,
  SortOption,
  Source,
  Thread,
  View,
  ViewQuery,
} from '../models'

/**
 * Publicaciones (temas) — el nucleo del API.
 *
 * Dos detalles del backend condicionan todo este archivo:
 *
 *   1. `GET /views` usa autenticacion OPCIONAL. Si la peticion viaja con un
 *      JWT valido, cada publicacion trae ademas `isFavorite` y `myReaction`
 *      por cara; sin token esos campos no vienen. Por eso NO se pasa
 *      `auth: false`: interesa mandar el token cuando exista.
 *   2. El API solo sabe ordenar por el total de likes/dislikes de AMBAS caras
 *      sumadas. El ordenamiento por cara concreta que pide el enunciado se
 *      resuelve en el cliente — ver `applySideSort`.
 */

/** Traduce el orden de la UI al parametro que acepta el API (`sort`). */
const SORT_PARAM: Record<SortOption, 'recent' | 'likes'> = {
  recientes: 'recent',
  // Ambos piden al API el orden por likes totales; el desempate por cara
  // concreta se aplica despues sobre la pagina recibida.
  likesA: 'likes',
  likesB: 'likes',
}

/**
 * Ordena por los likes de UNA cara concreta.
 *
 * LIMITACION CONOCIDA, documentada tambien en el README: el API no expone un
 * ordenamiento por cara (`views.service.ts` del backend ordena por
 * `totalLikes` / `totalDislikes`, la suma de las dos caras). Como el API es un
 * insumo que no se puede modificar, se le pide el orden por likes totales
 * —que ya deja arriba las publicaciones mas votadas— y se reordena la pagina
 * recibida por la cara elegida. El orden es exacto dentro de la pagina.
 */
function applySideSort(views: View[], sort: SortOption): View[] {
  if (sort === 'recientes') return views

  const pick = sort === 'likesA' ? (view: View) => view.ladoA.likes : (view: View) => view.ladoB.likes

  // Copia antes de ordenar: `sort` muta el array y el llamador puede estar
  // reutilizando el resultado del cache.
  return [...views].sort((a, b) => pick(b) - pick(a))
}

/** Clave de cache del ultimo tablero cargado, para el modo sin conexion. */
const BOARD_SNAPSHOT_KEY = CACHE_KEYS.board

interface BoardSnapshot {
  views: View[]
}

/** Cuerpo que espera el API al crear o actualizar una publicacion. */
export interface ViewFormPayload {
  categoriaId: string
  ladoA: { titulo: string; descripcion: string; fuentes: Omit<Source, 'id'>[] }
  ladoB: { titulo: string; descripcion: string; fuentes: Omit<Source, 'id'>[] }
  hashtags: string[]
}

function toViewBody(payload: ViewFormPayload) {
  const toSideBody = (side: ViewFormPayload['ladoA']) => ({
    title: side.titulo,
    description: side.descripcion,
    sources: side.fuentes.map((fuente) => ({
      type: toSourceTypeDto(fuente.tipo),
      url: fuente.url,
      label: fuente.titulo || undefined,
    })),
  })

  return {
    categoryId: payload.categoriaId,
    // El API llama `side` al Lado A y `counterpart` al Lado B.
    side: toSideBody(payload.ladoA),
    counterpart: toSideBody(payload.ladoB),
    hashtags: payload.hashtags,
  }
}

export const viewsService = {
  /**
   * GET /views — listado paginado con filtros.
   *
   * Guarda ademas una instantanea del resultado para que el tablero pueda
   * mostrar contenido si el API deja de responder (seccion 3.5).
   */
  async list(query: ViewQuery = {}, signal?: AbortSignal): Promise<Paginated<View>> {
    const sort = query.sort ?? 'recientes'

    const params = buildQuery({
      page: query.page,
      limit: query.limit,
      category: query.category,
      // El API filtra por UN solo hashtag (`?hashtag=`), no por una lista.
      hashtag: query.hashtags?.[0],
      sort: SORT_PARAM[sort],
      autorId: query.autorId,
      autor: query.soloMias ? 'me' : undefined,
    })

    const dto = await http.get<ViewListResponseDto>(`/views${params}`, { signal })

    const views = applySideSort(dto.views.map(toView), sort)
    const limit = dto.limit || 1

    if ((query.page ?? 1) === 1) {
      cacheService.set<BoardSnapshot>(BOARD_SNAPSHOT_KEY, { views })
    }

    return {
      data: views,
      page: dto.page,
      limit: dto.limit,
      total: dto.total,
      // El API devuelve `total` y `limit` pero no el numero de paginas.
      totalPages: Math.max(1, Math.ceil(dto.total / limit)),
    }
  },

  /** Ultimo tablero conocido. Se usa cuando el API no responde. */
  readCachedBoard(): View[] {
    return cacheService.getStale<BoardSnapshot>(BOARD_SNAPSHOT_KEY)?.value.views ?? []
  },

  /** GET /views/:id — detalle completo con ambas caras y sus contadores. */
  async detail(id: string, signal?: AbortSignal): Promise<View> {
    const dto = await http.get<ViewResponseDto>(`/views/${id}`, { signal })
    return toView(dto.view)
  },

  /**
   * GET /search?q= — busqueda global.
   *
   * El API busca a la vez en publicaciones, categorias, hashtags y autores; de
   * momento solo se consumen las publicaciones. Las caras que devuelve vienen
   * recortadas (sin descripcion ni contadores), cosa que el mapper tolera.
   */
  async search(term: string, signal?: AbortSignal): Promise<View[]> {
    const dto = await http.get<SearchResponseDto>(`/search${buildQuery({ q: term })}`, {
      auth: false,
      signal,
    })

    return dto.views.map(toView)
  },

  /** GET /views/:id/threads — hilos con sus comentarios de primer nivel. */
  async threads(id: string, signal?: AbortSignal): Promise<Thread[]> {
    const dto = await http.get<ThreadsResponseDto>(`/views/${id}/threads`, {
      auth: false,
      signal,
    })

    return dto.threads.map(toThread)
  },

  /**
   * POST /views/:id/sides/{a|b}/{like|dislike}
   *
   * La ruta se compone con el lado, de modo que es imposible reaccionar al
   * Lado A y afectar los contadores del Lado B: cada cara es una fila distinta
   * de `view_sides` en el API, con su propia coleccion de reacciones.
   *
   * La respuesta trae UNICAMENTE los contadores de la cara afectada, asi que
   * se devuelven como un parche del `Side` correspondiente en vez de una
   * publicacion completa.
   */
  async react(
    id: string,
    side: SideKey,
    reaction: Reaction,
  ): Promise<Pick<Side, 'likes' | 'dislikes' | 'miReaccion'>> {
    const dto = await http.post<ReactionResponseDto>(`/views/${id}/sides/${side}/${reaction}`)

    return {
      likes: dto.likeCount,
      dislikes: dto.dislikeCount,
      miReaccion: toReaction(dto.myReaction),
    }
  },

  /**
   * POST /views/:id/threads — abre un hilo nuevo.
   * El API exige el primer comentario en el mismo cuerpo (`content`).
   */
  async createThread(id: string, tema: string, contenido: string): Promise<Thread> {
    const dto = await http.post<ThreadResponseDto>(`/views/${id}/threads`, {
      title: tema || undefined,
      content: contenido,
    })

    return toThread(dto.thread)
  },

  /**
   * POST /views/:id/threads/:threadId/comments — comenta en un hilo existente.
   * Se recarga el hilo completo despues, porque la respuesta trae el comentario
   * suelto y la UI necesita el hilo actualizado.
   */
  async createComment(id: string, threadId: string, texto: string): Promise<void> {
    await http.post(`/views/${id}/threads/${threadId}/comments`, { content: texto })
  },

  /** POST /views — crear publicacion (requiere JWT). */
  async create(payload: ViewFormPayload): Promise<View> {
    const dto = await http.post<ViewResponseDto>('/views', toViewBody(payload))
    return toView(dto.view)
  },

  /** PUT /views/:id — actualizar (solo autor o superadmin; si no, 403). */
  async update(id: string, payload: ViewFormPayload): Promise<View> {
    const dto = await http.put<ViewResponseDto>(`/views/${id}`, toViewBody(payload))
    return toView(dto.view)
  },

  /** PATCH /views/:id/unpublish — retira la publicacion (solo superadmin). */
  async unpublish(id: string): Promise<void> {
    await http.patch<ViewResponseDto>(`/views/${id}/unpublish`)
  },

  /** PATCH /views/:id/publish — la devuelve al tablero (solo superadmin). */
  async publish(id: string): Promise<void> {
    await http.patch<ViewResponseDto>(`/views/${id}/publish`)
  },
}
