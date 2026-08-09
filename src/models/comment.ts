import type { AuthorRef } from './user'

/** Entidad Comentario dentro de un hilo de discusion. */
export interface Comment {
  id: string
  texto: string
  autor: AuthorRef
  vistaId: string
  hiloId: string
  fechaCreacion: string
  /**
   * `true` cuando el comentario ya paso la moderacion automatica por IA.
   * Mientras es `false` la UI debe mostrarlo como "en moderacion".
   */
  moderado: boolean
}

/** Agrupacion de comentarios bajo una misma publicacion. */
export interface Thread {
  id: string
  tema: string
  vistaId: string
  comentarios: Comment[]
}
