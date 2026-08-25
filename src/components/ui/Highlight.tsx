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

  // `split` con grupo de captura devuelve las coincidencias intercaladas entre
  // el resto del texto: ['antes', 'termino', 'entre', 'termino', 'despues'].
  const pieces = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'))

  return (
    <>
      {pieces.map((piece, index) =>
        // Basta comparar el fragmento con el termino. Antes se anteponia un
        // `pattern.test(piece)`, redundante y ademas fragil: una expresion
        // regular con bandera /g conserva `lastIndex` entre llamadas, de modo
        // que el resultado depende del fragmento anterior.
        piece.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index}>{piece}</mark>
        ) : (
          <Fragment key={index}>{piece}</Fragment>
        ),
      )}
    </>
  )
}