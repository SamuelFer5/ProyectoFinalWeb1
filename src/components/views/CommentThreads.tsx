import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '../ui/States'
import { viewsService } from '../../services/views.service'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { toUserMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'
import type { Comment, Thread } from '../../models'

interface CommentThreadsProps {
  viewId: string
  threads: Thread[]
  /** Recarga los hilos desde el API tras publicar un comentario o un hilo. */
  onReload: () => Promise<void>
}

/**
 * Seccion de hilos de comentarios de una publicacion (Pantalla 4).
 *
 * El API modela la discusion en dos niveles: una publicacion tiene varios
 * `CommentThread`, y cada hilo tiene comentarios de primer nivel que a su vez
 * admiten UN nivel de respuestas. Abrir un hilo nuevo exige mandar su primer
 * comentario en la misma peticion (`POST /views/:id/threads` con `content`),
 * por eso el formulario de hilo nuevo pide tema y mensaje juntos.
 */
export function CommentThreads({ viewId, threads, onReload }: CommentThreadsProps) {
  const { isAuthenticated } = useAuth()

  return (
    <section aria-labelledby="comentarios-heading">
      <h2 id="comentarios-heading">Hilos de discusion</h2>

      {/* Advertencia de moderacion exigida por el enunciado. */}
      <p className="threads__notice" role="status">
        Los comentarios pasan por moderacion automatica con IA. Escriba con respeto: el
        contenido ofensivo puede ser retirado por un administrador.
      </p>

      {threads.length === 0 ? (
        <div className="state state--empty">
          <p className="state__title">Todavia no hay hilos abiertos</p>
          <p className="state__hint">
            Sea la primera persona en aportar argumentos sobre este tema.
          </p>
        </div>
      ) : (
        <ul className="threads__list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <details>
                <summary>
                  {thread.tema}
                  <span className="threads__count">
                    {thread.comentarios.length}{' '}
                    {thread.comentarios.length === 1 ? 'comentario' : 'comentarios'}
                  </span>
                </summary>

                <div className="comments">
                  {thread.comentarios.map((comentario) => (
                    <CommentItem key={comentario.id} comentario={comentario} />
                  ))}

                  {isAuthenticated ? (
                    <ReplyForm viewId={viewId} threadId={thread.id} onReload={onReload} />
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {isAuthenticated ? (
        <NewThreadForm viewId={viewId} onReload={onReload} />
      ) : (
        <p className="threads__login-hint">
          <Link to="/login">Inicie sesion</Link> para participar en la discusion.
        </p>
      )}
    </section>
  )
}

/** Un comentario y, si las tiene, sus respuestas de un solo nivel. */
function CommentItem({ comentario }: { comentario: Comment }) {
  return (
    <article className="comment">
      <p className="comment__meta">
        <strong>{comentario.autor.nombre}</strong>
        <time dateTime={comentario.fechaCreacion}>
          {formatDateTime(comentario.fechaCreacion)}
        </time>
        {/* El API no expone estado de moderacion; el indicador queda listo
            para cuando lo haga (ver models/comment.ts). */}
        {!comentario.moderado ? (
          <span className="badge badge--warning">En moderacion</span>
        ) : null}
      </p>
      <p>{comentario.texto}</p>

      {comentario.respuestas.length > 0 ? (
        <div className="comment__replies">
          {comentario.respuestas.map((respuesta) => (
            <CommentItem key={respuesta.id} comentario={respuesta} />
          ))}
        </div>
      ) : null}
    </article>
  )
}

/** Formulario para responder dentro de un hilo existente. */
function ReplyForm({
  viewId,
  threadId,
  onReload,
}: {
  viewId: string
  threadId: string
  onReload: () => Promise<void>
}) {
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const [texto, setTexto] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const contenido = texto.trim()
    if (contenido.length === 0) {
      toast.warning('Escriba un comentario antes de enviarlo.')
      return
    }

    if (!isOnline) {
      toast.error('No es posible realizar esta accion sin conexion al servidor.')
      return
    }

    setIsSubmitting(true)
    try {
      await viewsService.createComment(viewId, threadId, contenido)
      setTexto('')
      await onReload()
      toast.success('Comentario publicado')
    } catch (error) {
      toast.error(toUserMessage(error, 'No se pudo publicar el comentario.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className="comment-form"
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <label className="sr-only" htmlFor={`reply-${threadId}`}>
        Responder en este hilo
      </label>
      <textarea
        id={`reply-${threadId}`}
        rows={2}
        placeholder="Aporte su argumento..."
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value)
        }}
      />
      {/* Deshabilitado durante el envio: previene el doble submit. */}
      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Publicando" /> : null}
        {isSubmitting ? 'Publicando...' : 'Comentar'}
      </button>
    </form>
  )
}

/** Formulario para abrir un hilo nuevo con su primer comentario. */
function NewThreadForm({
  viewId,
  onReload,
}: {
  viewId: string
  onReload: () => Promise<void>
}) {
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const [tema, setTema] = useState('')
  const [texto, setTexto] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const contenido = texto.trim()
    if (contenido.length === 0) {
      toast.warning('El hilo necesita un primer comentario.')
      return
    }

    if (!isOnline) {
      toast.error('No es posible realizar esta accion sin conexion al servidor.')
      return
    }

    setIsSubmitting(true)
    try {
      await viewsService.createThread(viewId, tema.trim(), contenido)
      setTema('')
      setTexto('')
      await onReload()
      toast.success('Hilo abierto')
    } catch (error) {
      toast.error(toUserMessage(error, 'No se pudo abrir el hilo.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className="comment-form"
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <h3>Abrir un hilo nuevo</h3>

      <label className="sr-only" htmlFor="nuevo-hilo-tema">
        Tema del hilo (opcional)
      </label>
      <input
        id="nuevo-hilo-tema"
        className="field__input"
        type="text"
        placeholder="Tema del hilo (opcional)"
        value={tema}
        onChange={(event) => {
          setTema(event.target.value)
        }}
      />

      <label className="sr-only" htmlFor="nuevo-hilo-texto">
        Primer comentario del hilo
      </label>
      <textarea
        id="nuevo-hilo-texto"
        rows={3}
        placeholder="Primer comentario del hilo..."
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value)
        }}
      />

      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Abriendo hilo" /> : null}
        {isSubmitting ? 'Abriendo hilo...' : 'Abrir hilo'}
      </button>
    </form>
  )
}
