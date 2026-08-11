import type { ReactNode } from 'react'

/**
 * Los tres estados de UI que el enunciado exige a todo componente que llame al
 * API: carga, vacio y error. Viven juntos porque siempre se usan como un
 * conjunto excluyente dentro del mismo bloque de render.
 */

/** Indicador de carga en linea, para botones y bloques pequenos. */
export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />
}

/** Esqueleto de una tarjeta de publicacion. */
export function CardSkeleton() {
  return (
    <article className="card card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--badge" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
      <div className="skeleton skeleton--footer" />
    </article>
  )
}

/** Rejilla de esqueletos mientras carga un listado. */
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid" role="status" aria-label="Cargando publicaciones">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  /** Guia de accion: el enunciado pide que el vacio no sea solo un aviso. */
  hint?: string
  children?: ReactNode
}

export function EmptyState({ title, hint, children }: EmptyStateProps) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {hint ? <p className="state__hint">{hint}</p> : null}
      {children}
    </div>
  )
}

interface ErrorStateProps {
  message: string
  /** Si se pasa, se ofrece un boton de reintento. */
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">No se pudo cargar la informacion</p>
      <p className="state__hint">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  )
}
