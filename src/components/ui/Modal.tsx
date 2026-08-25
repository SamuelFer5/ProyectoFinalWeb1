import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Spinner } from './States'

/**
 * Dialogo modal accesible, construido sobre el elemento nativo <dialog>.
 *
 * Se usa `showModal()` en lugar de un div con posicion fija por la misma razon
 * por la que el menu de categorias usa <details>/<summary>: el navegador ya
 * aporta gratis todo lo que el criterio de accesibilidad exige y que a mano se
 * implementa mal casi siempre —
 *
 *   - atrapa el foco dentro del dialogo (focus trap) mientras esta abierto,
 *   - marca el resto de la pagina como inerte para el lector de pantalla,
 *   - cierra con Escape,
 *   - devuelve el foco al elemento que lo abrio al cerrarse,
 *   - expone `role="dialog"` y `aria-modal="true"` de forma implicita.
 *
 * El componente es CONTROLADO: `open` manda, y toda via de cierre (Escape,
 * clic en el fondo, boton) desemboca en `onClose` para que el estado del
 * llamador y el del DOM no puedan divergir.
 */

interface ModalProps {
  open: boolean
  titulo: string
  /** Texto opcional bajo el titulo; se enlaza con aria-describedby. */
  descripcion?: string
  children?: ReactNode
  /** Botonera inferior. Sin ella solo se ofrece "Cerrar". */
  footer?: ReactNode
  onClose: () => void
}

export function Modal({ open, titulo, descripcion, children, footer, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const baseId = useId()
  const titleId = `${baseId}-titulo`
  const descId = `${baseId}-descripcion`

  // Sincroniza el estado del DOM con la prop. `dialog.open` se consulta antes
  // de actuar porque llamar a showModal() sobre un dialogo ya abierto lanza.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // El fondo de la pagina no debe poder desplazarse mientras el modal esta
  // abierto: en movil es lo que provoca que el contenido "se escape" detras.
  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={descripcion ? descId : undefined}
      // Escape dispara `cancel`. Se cancela el cierre nativo y se delega en
      // `onClose`, de modo que cerrar por teclado recorra exactamente el mismo
      // camino que pulsar el boton.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Un clic sobre ::backdrop tiene como `target` al propio <dialog>: es la
      // forma estandar de distinguir el fondo del contenido.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="modal__panel">
        <header className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {titulo}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Cerrar dialogo"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        {descripcion ? (
          <p className="modal__description" id={descId}>
            {descripcion}
          </p>
        ) : null}

        {children ? <div className="modal__body">{children}</div> : null}

        <footer className="modal__footer">
          {footer ?? (
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cerrar
            </button>
          )}
        </footer>
      </div>
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  titulo: string
  mensaje: string
  /** Rotulo del boton que ejecuta la accion. */
  confirmLabel?: string
  /** `true` pinta el boton en rojo: la accion retira o destruye algo. */
  danger?: boolean
  /** Bloquea la botonera mientras la peticion esta en vuelo (doble submit). */
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmacion de una accion destructiva.
 *
 * Sustituye a `window.confirm()`, que el enunciado penaliza explicitamente
 * (los dialogos nativos del navegador no son estilizables, no respetan el tema
 * y bloquean el hilo). Las tres pantallas de administracion lo reutilizan.
 */
export function ConfirmDialog({
  open,
  titulo,
  mensaje,
  confirmLabel = 'Confirmar',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      titulo={titulo}
      descripcion={mensaje}
      // Mientras la peticion esta en vuelo no se permite cerrar: el usuario
      // perderia de vista el resultado de una accion que ya se disparo.
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner label="Procesando" /> : null}
            {busy ? 'Procesando...' : confirmLabel}
          </button>
        </>
      }
    />
  )
}
