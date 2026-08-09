import type { AuthorRef } from './user'

/** Entidad Comentario dentro de un hilo de discusion. */
export interface Comment {
  id: string
  texto: string
  autor: AuthorRef
  hiloId: string
  fechaCreacion: string
  /**
   * El enunciado contempla moderacion automatica por IA, pero el API entregado
   * no expone ningun campo de moderacion: todo comentario queda publicado al
   * crearse. Se mantiene la propiedad para no perder el concepto y se fija en
   * `true`; el dia que el API informe el estado real, solo cambia el mapper.
   */
  moderado: boolean
  /** El API admite un unico nivel de respuestas por comentario. */
  respuestas: Comment[]
}

/** Agrupacion de comentarios bajo una misma publicacion. */
export interface Thread {
  id: string
  tema: string
  vistaId: string
  fechaCreacion: string
  comentarios: Comment[]
}
