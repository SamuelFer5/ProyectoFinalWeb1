import { http, buildQuery } from './http'
import { toCategory, toUser, toView } from './mappers'
import type {
  AdminUsersResponseDto,
  CategoriesResponseDto,
  CategoryResponseDto,
  UserWrapperDto,
  ViewListResponseDto,
} from '../models/dto'
import type { Category, Paginated, User, View } from '../models'

/**
 * Operaciones exclusivas del rol superadministrador (pantallas 7, 8 y 9).
 *
 * Todas las rutas de `/admin/*` estan protegidas en el API por
 * `authenticate + requireRole('SUPERADMIN')`, de modo que un token de usuario
 * corriente recibe 403. El guard de ruta del cliente evita llegar hasta aqui,
 * pero el 403 igual se maneja: el rol podria haber cambiado despues de emitir
 * el token.
 */

/** Estado por el que filtra la pantalla de moderacion. */
export type ViewStatusFilter = 'todas' | 'publicadas' | 'despublicadas'

/** Traduce el filtro de la UI al parametro `status` que acepta el API. */
const STATUS_PARAM: Record<ViewStatusFilter, 'PUBLISHED' | 'UNPUBLISHED' | undefined> = {
  todas: undefined,
  publicadas: 'PUBLISHED',
  despublicadas: 'UNPUBLISHED',
}

interface ListUsersQuery {
  page?: number
  limit?: number
  search?: string
}

interface ListViewsQuery {
  page?: number
  limit?: number
  status?: ViewStatusFilter
}

export const adminService = {
  // --- Pantalla 7: gestion de usuarios ---------------------------------------

  /**
   * GET /admin/users?page=&search=
   *
   * El API busca por nombre O correo con `contains` insensible a mayusculas, de
   * modo que un unico campo de texto cubre las dos columnas que pide el
   * enunciado.
   */
  async listUsers(query: ListUsersQuery = {}, signal?: AbortSignal): Promise<Paginated<User>> {
    const params = buildQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
    })

    const dto = await http.get<AdminUsersResponseDto>(`/admin/users${params}`, { signal })
    const limit = dto.limit || 1

    return {
      data: dto.users.map(toUser),
      page: dto.page,
      limit: dto.limit,
      total: dto.total,
      totalPages: Math.max(1, Math.ceil(dto.total / limit)),
    }
  },

  /**
   * PATCH /admin/users/:id/ban — deja la cuenta en estado SUSPENDED.
   *
   * OJO: el API NO impide que un superadmin se banee a si mismo
   * (`users.service.ts` del backend solo comprueba que el usuario exista). El
   * control que exige el enunciado es, por tanto, responsabilidad exclusiva del
   * cliente: la pantalla no debe ofrecer el boton sobre la propia fila.
   */
  async banUser(id: string): Promise<User> {
    const dto = await http.patch<UserWrapperDto>(`/admin/users/${id}/ban`)
    return toUser(dto.user)
  },

  /**
   * PATCH /admin/users/:id/unban — devuelve la cuenta a ACTIVE.
   * Nota: aplicado sobre una cuenta PENDING tambien la activa.
   */
  async unbanUser(id: string): Promise<User> {
    const dto = await http.patch<UserWrapperDto>(`/admin/users/${id}/unban`)
    return toUser(dto.user)
  },

  // --- Pantalla 8: gestion de categorias --------------------------------------

  /**
   * GET /admin/categories — a diferencia del `/categories` publico, incluye las
   * inactivas (las que tienen `deletedAt`), que es lo que permite mostrar la
   * columna de estado.
   */
  async listCategories(signal?: AbortSignal): Promise<Category[]> {
    const dto = await http.get<CategoriesResponseDto>('/admin/categories', { signal })
    return dto.categories.map(toCategory)
  },

  /**
   * POST /admin/categories — body `{ name }`.
   *
   * El API solo acepta el nombre: el modelo `Category` de Prisma no tiene
   * columna de descripcion. Un nombre repetido llega como 409.
   */
  async createCategory(nombre: string): Promise<Category> {
    const dto = await http.post<CategoryResponseDto>('/admin/categories', { name: nombre })
    return toCategory(dto.category)
  },

  /** PUT /admin/categories/:id — body `{ name }`. */
  async updateCategory(id: string, nombre: string): Promise<Category> {
    const dto = await http.put<CategoryResponseDto>(`/admin/categories/${id}`, { name: nombre })
    return toCategory(dto.category)
  },

  /**
   * DELETE /admin/categories/:id — responde 204 sin cuerpo.
   *
   * Es un borrado LOGICO: el backend escribe `deletedAt` en vez de eliminar la
   * fila, precisamente para no romper las publicaciones que ya apuntan a esa
   * categoria. Por eso la categoria sigue apareciendo en este listado, ahora
   * como inactiva, y las publicaciones asociadas no se pierden.
   */
  async deleteCategory(id: string): Promise<void> {
    await http.delete<void>(`/admin/categories/${id}`)
  },

  // --- Pantalla 9: moderacion de contenido ------------------------------------

  /**
   * GET /admin/views?status=&page= — incluye las despublicadas, que el listado
   * publico `/views` nunca devuelve.
   */
  async listViews(query: ListViewsQuery = {}, signal?: AbortSignal): Promise<Paginated<View>> {
    const params = buildQuery({
      page: query.page,
      limit: query.limit,
      status: STATUS_PARAM[query.status ?? 'todas'],
    })

    const dto = await http.get<ViewListResponseDto>(`/admin/views${params}`, { signal })
    const limit = dto.limit || 1

    return {
      data: dto.views.map(toView),
      page: dto.page,
      limit: dto.limit,
      total: dto.total,
      totalPages: Math.max(1, Math.ceil(dto.total / limit)),
    }
  },
}
