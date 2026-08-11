import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './context/ThemeProvider'
import { ToastProvider } from './context/ToastProvider'
import { AuthProvider } from './context/AuthProvider'
import { AppRouter } from './router'
import './index.css'

/**
 * Punto de entrada.
 *
 * El orden de anidamiento de los providers NO es arbitrario:
 *
 *   ThemeProvider  — independiente, no consume ningun otro contexto.
 *   ToastProvider  — debe envolver a AuthProvider, porque este llama a
 *                    useToast() para avisar cuando la sesion expira.
 *   AuthProvider   — debe envolver al router, porque los guards consultan
 *                    useAuth() para decidir si dejan pasar.
 *
 * Invertir ToastProvider y AuthProvider hace que la aplicacion falle al montar.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('No se encontro el elemento #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
