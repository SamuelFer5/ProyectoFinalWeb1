/** Entidad Categoria — clasificacion tematica de las publicaciones. */
export interface Category {
  id: string
  nombre: string
  /**
   * El API no almacena descripcion de categoria (el modelo `Category` solo
   * tiene `name` y `deletedAt`). Se conserva el campo porque el enunciado lo
   * pide y queda vacio hasta que el API lo provea; la UI no debe asumir texto.
   */
  descripcion: string
  /** Derivado de `deletedAt === null` — el API usa borrado logico. */
  activo: boolean
  /** Se calcula en el cliente con el `total` del listado de publicaciones. */
  totalPublicaciones?: number
}
