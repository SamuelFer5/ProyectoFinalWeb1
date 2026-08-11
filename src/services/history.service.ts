import { CACHE_KEYS, HISTORY_LIMIT, cacheService } from './cache.service'
import type { HistoryEntry, View } from '../models'

/**
 * Historial local de publicaciones vistas.
 *
 * Vive integramente en `lasdoscaras_history`: el enunciado especifica que esta
 * funcionalidad no debe generar ninguna llamada al API. Es una cola FIFO de
 * como maximo 20 entradas — la mas reciente al frente.
 */
export const historyService = {
  read(): HistoryEntry[] {
    return cacheService.get<HistoryEntry[]>(CACHE_KEYS.history) ?? []
  },

  /**
   * Registra una visita. Si la publicacion ya estaba en el historial se mueve
   * al frente en lugar de duplicarse, y el excedente se recorta por la cola.
   */
  record(view: View): void {
    const entry: HistoryEntry = {
      id: view.id,
      titulo: view.titulo,
      categoria: view.categoria?.nombre ?? 'Sin categoria',
      fechaVista: new Date().toISOString(),
    }

    const previous = historyService.read().filter((item) => item.id !== view.id)
    cacheService.set(CACHE_KEYS.history, [entry, ...previous].slice(0, HISTORY_LIMIT))
  },

  clear(): void {
    cacheService.remove(CACHE_KEYS.history)
  },
}
