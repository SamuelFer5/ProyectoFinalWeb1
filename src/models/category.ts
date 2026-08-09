/** Entidad Categoria — clasificacion tematica de las publicaciones. */
export interface Category {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
  /** Solo lo devuelve el API en la pagina de categoria y el panel admin. */
  totalPublicaciones?: number
}
