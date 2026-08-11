import { Fragment } from 'react'

/** Escapa los caracteres con significado especial en una expresion regular. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface HighlightProps {
  text: string
  /** Termino a resaltar. Si viene vacio, el texto se renderiza intacto. */
  term?: string
}


export function Highlight({ text, term }: HighlightProps) {
  const needle = term?.trim() ?? ''
  if (needle.length === 0) return <>{text}</>

  const pattern = new RegExp(`(${escapeRegExp(needle)})`, 'gi')
  const pieces = text.split(pattern)

  return (
    <>
      {pieces.map((piece, index) =>
        pattern.test(piece) && piece.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index}>{piece}</mark>
        ) : (
          <Fragment key={index}>{piece}</Fragment>
        ),
      )}
    </>
  )
}