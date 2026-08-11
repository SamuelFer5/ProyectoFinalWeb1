/** Formatea una fecha ISO del API al formato largo en espanol. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida'

  return date.toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Igual que `formatDate` pero incluyendo la hora. Se usa en el historial. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida'

  return date.toLocaleString('es-CR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Recorta un texto largo en el limite de palabra mas cercano. */
export function excerpt(text: string, maxLength = 180): string {
  if (text.length <= maxLength) return text

  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}...`
}

/**
 * Extrae el ID de un video de YouTube desde cualquiera de sus formatos de URL
 * (watch?v=, youtu.be/, /embed/, /shorts/). Devuelve `null` si no es YouTube.
 */
export function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return parsed.pathname.slice(1) || null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery) return fromQuery

      const match = /^\/(?:embed|shorts|v)\/([^/?]+)/.exec(parsed.pathname)
      return match?.[1] ?? null
    }

    return null
  } catch {
    return null
  }
}
