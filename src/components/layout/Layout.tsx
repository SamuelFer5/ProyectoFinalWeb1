import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { ToastContainer } from '../ui/ToastContainer'
import { ConnectionBanner } from '../ui/ConnectionBanner'

/**
 * Estructura comun a todas las pantallas. Las paginas de error tambien la
 * heredan, tal como pide el enunciado ("ambas paginas deben mantener la navbar
 * y el layout general").
 */
export function Layout() {
  return (
    <div className="app-shell">
      {/* Salto de navegacion para usuarios de teclado y lector de pantalla. */}
      <a className="skip-link" href="#contenido">
        Saltar al contenido principal
      </a>

      <Navbar />
      <ConnectionBanner />

      <main id="contenido" className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>
          LasDosCaras — Las dos narrativas de cada tema · Proyecto Integrador ISW-521,
          Universidad Tecnica Nacional
        </p>
      </footer>

      <ToastContainer />
    </div>
  )
}
