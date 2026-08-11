import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'
import { useDebounce } from '../../hooks/useDebounce'
import { catalogService } from '../../services/catalog.service'
import type { Category } from '../../models'

/**
 * Barra de navegacion global.
 *
 * Incluye la busqueda con debounce de 300 ms, el conmutador de tema y el bloque
 * de sesion (login/registro o menu de perfil), tal como especifica la Pantalla 1.
 */
export function Navbar() {
  const { isAuthenticated, user, isSuperadmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [term, setTerm] = useState(() => searchParams.get('q') ?? '')
  const debouncedTerm = useDebounce(term, 300)
  const isFirstRun = useRef(true)

  // Acceso a categorias desde la navbar (Pantalla 1). Arranca con el catalogo
  // cacheado para que el menu este utilizable antes de que el API conteste, y
  // se revalida en segundo plano — el mismo patron cache-first del tablero.
  const [categories, setCategories] = useState<Category[]>(() =>
    catalogService.readStaleCategories(),
  )
  const categoriesMenu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    catalogService
      .fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => {
        // Silencioso: el menu sigue sirviendo las categorias del cache.
      })

    return () => {
      controller.abort()
    }
  }, [])

  /**
   * Navegacion automatica tras el debounce. Se omite el primer ciclo para no
   * redirigir solo por montar el componente con un termino ya presente en la URL.
   */
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    if (debouncedTerm.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(debouncedTerm.trim())}`)
    }
  }, [debouncedTerm, navigate])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = term.trim()

    if (trimmed.length === 0) {
      toast.info('Escriba un termino para buscar.')
      return
    }

    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const handleLogout = () => {
    logout()
    toast.success('Sesion cerrada')
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link className="navbar__brand" to="/">
          <span className="navbar__logo" aria-hidden="true">
            ◑
          </span>
          <span>
            Las<strong>Dos</strong>Caras
          </span>
        </Link>

        <form className="navbar__search" role="search" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="global-search">
            Buscar publicaciones
          </label>
          <input
            id="global-search"
            type="search"
            placeholder="Buscar temas, hashtags..."
            value={term}
            onChange={(event) => {
              setTerm(event.target.value)
            }}
          />
          <button type="submit" aria-label="Buscar">
            <span aria-hidden="true">🔍</span>
          </button>
        </form>

        <nav className="navbar__links" aria-label="Navegacion principal">
          <NavLink to="/" end>
            Tablero
          </NavLink>

          {/*
            Menu de categorias. Se construye con <details>/<summary> en lugar de
            un dropdown a mano porque el navegador ya aporta gratis el estado
            abierto/cerrado, el foco y la operacion por teclado (Enter/Espacio),
            que es justo lo que exige el criterio de accesibilidad.

            Cada entrada lleva al tablero filtrado (`/?category=`) y no a
            /categories/:id: esa pantalla (la 6) todavia no esta construida, y
            enlazar a un marcador seria peor experiencia que al filtro real.
          */}
          <details className="navbar__categories" ref={categoriesMenu}>
            <summary aria-label="Ver categorias">Categorias</summary>
            <ul>
              {categories.length === 0 ? (
                <li className="navbar__categories-empty">Cargando categorias...</li>
              ) : (
                categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/?category=${category.id}`}
                      onClick={() => {
                        // Cerrar el menu al navegar: sin esto quedaria abierto
                        // sobre la pantalla de destino.
                        if (categoriesMenu.current) categoriesMenu.current.open = false
                      }}
                    >
                      {category.nombre}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </details>

          {isSuperadmin ? <NavLink to="/admin/users">Admin</NavLink> : null}

          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>

          {isAuthenticated ? (
            <div className="navbar__session">
              <Link className="navbar__user" to="/profile">
                {user?.nombre ?? 'Mi perfil'}
              </Link>
              <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                Salir
              </button>
            </div>
          ) : (
            <div className="navbar__session">
              <Link className="btn btn--ghost" to="/login">
                Iniciar sesion
              </Link>
              <Link className="btn btn--primary" to="/register">
                Registrarse
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
