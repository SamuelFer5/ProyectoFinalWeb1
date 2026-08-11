import { useState } from 'react'
import { Spinner } from '../ui/States'
import { youtubeId } from '../../utils/format'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { toUserMessage } from '../../utils/errors'
import type { Reaction, Side, SideKey, Source } from '../../models'

interface SidePanelProps {
  side: Side
  sideKey: SideKey
  /** "Postura" para el Lado A, "Contrapostura" para el Lado B. */
  heading: string
  onReact: (sideKey: SideKey, reaction: Reaction) => Promise<void>
}

/**
 * Una de las dos caras del tema, con su contenido, sus fuentes y su propia
 * barra de reacciones.
 *
 * El componente recibe el objeto `Side` completo y la clave del lado, y no
 * conoce en absoluto al lado contrario. Esa es la garantia estructural de que
 * los contadores de A y B jamas comparten estado: no hay ninguna variable
 * accesible desde aqui que pertenezca a la otra cara.
 */
export function SidePanel({ side, sideKey, heading, onReact }: SidePanelProps) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const [pending, setPending] = useState<Reaction | null>(null)

  const handleReact = async (reaction: Reaction) => {
    if (pending !== null) return

    if (!isAuthenticated) {
      toast.warning('Inicie sesion para reaccionar a esta postura.')
      return
    }

    if (!isOnline) {
      toast.error('No es posible realizar esta accion sin conexion al servidor.')
      return
    }

    setPending(reaction)
    try {
      await onReact(sideKey, reaction)
    } catch (error) {
      toast.error(toUserMessage(error, 'No se pudo registrar su reaccion.'))
    } finally {
      setPending(null)
    }
  }

  return (
    <section className={`side side--${sideKey}`} aria-labelledby={`side-${sideKey}-heading`}>
      <header className="side__header">
        <span className="side__kicker">{heading}</span>
        <h2 className="side__title" id={`side-${sideKey}-heading`}>
          {side.titulo}
        </h2>
      </header>

      <div className="side__body">
        {side.descripcion.split(/\n{2,}/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      {/* Barra de reacciones propia de esta cara. */}
      <div className="reactions" role="group" aria-label={`Reacciones a la ${heading}`}>
        <button
          type="button"
          className={`reaction${side.miReaccion === 'like' ? ' is-active' : ''}`}
          onClick={() => {
            void handleReact('like')
          }}
          disabled={pending !== null}
          aria-pressed={side.miReaccion === 'like'}
          aria-label={`Me gusta la ${heading}. Actualmente ${side.likes} votos`}
        >
          {pending === 'like' ? <Spinner /> : <span aria-hidden="true">👍</span>}
          <span className="reaction__count">{side.likes}</span>
        </button>

        <button
          type="button"
          className={`reaction${side.miReaccion === 'dislike' ? ' is-active' : ''}`}
          onClick={() => {
            void handleReact('dislike')
          }}
          disabled={pending !== null}
          aria-pressed={side.miReaccion === 'dislike'}
          aria-label={`No me gusta la ${heading}. Actualmente ${side.dislikes} votos`}
        >
          {pending === 'dislike' ? <Spinner /> : <span aria-hidden="true">👎</span>}
          <span className="reaction__count">{side.dislikes}</span>
        </button>
      </div>

      <SourceList sources={side.fuentes ?? []} heading={heading} />
    </section>
  )
}

/** Fuentes de referencia de esta cara, con embed para los videos de YouTube. */
function SourceList({ sources, heading }: { sources: Source[]; heading: string }) {
  if (sources.length === 0) {
    return <p className="side__no-sources">Esta {heading.toLowerCase()} no tiene fuentes registradas.</p>
  }

  return (
    <div className="sources">
      <h3 className="sources__title">Fuentes de la {heading.toLowerCase()}</h3>
      <ul className="sources__list">
        {sources.map((source) => {
          const videoId = source.tipo === 'youtube' ? youtubeId(source.url) : null

          return (
            <li key={source.id} className="source">
              <span className="source__icon" aria-hidden="true">
                {source.tipo === 'youtube' ? '▶' : source.tipo === 'documento' ? '📄' : '🔗'}
              </span>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.titulo}
              </a>

              {videoId ? (
                <div className="source__embed">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                    title={source.titulo}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
