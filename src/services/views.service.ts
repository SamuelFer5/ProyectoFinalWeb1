import { http, buildQuery } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import type {
  Comment as ViewComment,
  Paginated,
  Reaction,
  SideKey,
  SortOption,
  Thread,
  View,
  ViewQuery,
} from '../models'

/** Traduce el orden de la UI al parametro que espera el API. */
const SORT_PARAM: Record<SortOption, string> = {
  recientes: 'recent',
  likesA: 'likesA',
  likesB: 'likesB',
}

/** Clave de cache del ultimo tablero cargado, para el modo sin conexion. */
const BOARD_SNAPSHOT_KEY = CACHE_KEYS.board

interface BoardSnapshot {
  views: View[]
}

export const viewsService = {
  /**
   * GET /views — listado paginado con filtros.
   *
   * Guarda ademas una instantanea del resultado para que el tablero pueda
   * mostrar contenido si el API deja de responder (seccion 3.5).
   */
  async list(query: ViewQuery = {}, signal?: AbortSignal): Promise<Paginated<View>> {
    const params = buildQuery({
      page: query.page,
      limit: query.limit,
      category: query.category,
      hashtag: query.hashtags,
      sort: query.sort ? SORT_PARAM[query.sort] : undefined,
      autorId: query.autorId,
    })

    const result = await http.get<Paginated<View>>(`/views${params}`, {
      auth: false,
      signal,
    })

    if ((query.page ?? 1) === 1) {
      cacheService.set<BoardSnapshot>(BOARD_SNAPSHOT_KEY, { views: result.data })
    }

    return result
  },

  /** Ultimo tablero conocido. Se usa cuando el API no responde. */
  readCachedBoard(): View[] {
    return cacheService.getStale<BoardSnapshot>(BOARD_SNAPSHOT_KEY)?.value.views ?? []
  },

  /** GET /views/:id — detalle completo con ambas caras y sus contadores. */
  detail: (id: string, signal?: AbortSignal): Promise<View> =>
    http.get<View>(`/views/${id}`, { auth: false, signal }),

  /** GET /search?q= — busqueda global por texto libre. */
  search: (term: string, signal?: AbortSignal): Promise<Paginated<View>> =>
    http.get<Paginated<View>>(`/search${buildQuery({ q: term })}`, {
      auth: false,
      signal,
    }),

  /** GET /views/:id/threads — hilos de comentarios de la publicacion. */
  threads: (id: string, signal?: AbortSignal): Promise<Thread[]> =>
    http.get<Thread[]>(`/views/${id}/threads`, { auth: false, signal }),

  /**
   * POST /views/:id/sides/{a|b}/{like|dislike}
   *
   * La ruta se compone con el lado, de modo que es imposible reaccionar al Lado
   * A y afectar los contadores del Lado B: cada cara tiene su propio endpoint y
   * su propio objeto `Side` en la respuesta.
   */
  react: (id: string, side: SideKey, reaction: Reaction): Promise<View> =>
    http.post<View>(`/views/${id}/sides/${side}/${reaction}`),

  /** POST /views/:id/threads — abre un hilo nuevo. */
  createThread: (id: string, tema: string): Promise<Thread> =>
    http.post<Thread>(`/views/${id}/threads`, { tema }),

  /** POST /views/:id/threads/:threadId/comments — comenta en un hilo. */
  createComment: (
    id: string,
    threadId: string,
    texto: string,
  ): Promise<ViewComment> =>
    http.post<ViewComment>(`/views/${id}/threads/${threadId}/comments`, { texto }),

  /** PATCH /views/:id/unpublish — retira la publicacion (solo superadmin). */
  unpublish: (id: string): Promise<View> => http.patch<View>(`/views/${id}/unpublish`),
}
