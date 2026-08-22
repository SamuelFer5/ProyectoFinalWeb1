import type { BoardFilters, SortOption } from '../models'

/**
 * Traduccion entre los filtros del tablero y los query params de la URL.
 *
 * Vive en `utils/` y no dentro de una pantalla porque hay dos listados que
 * comparten exactamente el mismo contrato de URL: el tablero principal
 * (Pantalla 1) y la pagina de categoria (Pantalla 6). Tener una sola
 * implementacion garantiza que `?sort=likesB` signifique lo mismo en ambas y
 * que un enlace copiado de una funcione en la otra.
 */

const SORT_VALUES: SortOption[] = ['recientes', 'likesA', 'likesB']

export function isSortOption(value: string | null): value is SortOption {
  return value !== null && SORT_VALUES.includes(value as SortOption)
}

/** Lee los filtros de la URL. Funcion pura: la URL es la fuente de verdad. */
export function parseFilters(params: URLSearchParams): BoardFilters {
  const sort = params.get('sort')

  return {
    category: params.get('category'),
    hashtags: params.get('hashtag')?.split(',').filter(Boolean) ?? [],
    sort: isSortOption(sort) ? sort : 'recientes',
  }
}

/** `true` si la URL ya trae filtros explicitos puestos por el usuario. */
export function hasFilterParams(params: URLSearchParams): boolean {
  return params.has('category') || params.has('hashtag') || params.has('sort')
}

/** Serializa filtros y pagina a query params, omitiendo los valores por defecto. */
export function toSearchParams(filters: BoardFilters, page: number): URLSearchParams {
  const next = new URLSearchParams()
  if (filters.category) next.set('category', filters.category)
  if (filters.hashtags.length > 0) next.set('hashtag', filters.hashtags.join(','))
  if (filters.sort !== 'recientes') next.set('sort', filters.sort)
  if (page > 1) next.set('page', String(page))
  return next
}

/**
 * Variante para la pagina de categoria: la categoria ya la fija la ruta
 * (`/categories/:id`), asi que nunca debe viajar tambien como query param.
 */
export function toCategorySearchParams(
  filters: BoardFilters,
  page: number,
): URLSearchParams {
  return toSearchParams({ ...filters, category: null }, page)
}