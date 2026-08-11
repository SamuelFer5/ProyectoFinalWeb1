import { http } from './http'
import { toAuthorProfile } from './mappers'
import type { AuthorResponseDto } from '../models/dto'
import type { AuthorProfile } from '../models'

/**
 * Perfil publico de autor (Pantalla 11).
 *
 * Las publicaciones del autor NO se piden aqui: se obtienen con
 * `viewsService.list({ autorId })`, que reutiliza el mismo listado paginado del
 * tablero y por tanto las mismas tarjetas.
 */
export const authorsService = {
  /** GET /authors/:id — nombre, fecha de registro y conteo de publicaciones. */
  async fetch(id: string, signal?: AbortSignal): Promise<AuthorProfile> {
    const dto = await http.get<AuthorResponseDto>(`/authors/${id}`, {
      auth: false,
      signal,
    })

    return toAuthorProfile(dto.author)
  },
}
