import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // La URL es la unica fuente de verdad del termino, igual que con los filtros
  // del tablero. El estado local existe solo para que el input sea controlado
  // entre pulsacion y pulsacion, y se resincroniza en cuanto la URL cambia por
  // otra via: el campo de refinamiento de /search, un enlace entrante o el
  // boton Atras del navegador.
  const urlTerm = searchParams.get('q') ?? ''
  const isOnSearch = location.pathname === '/search'

  const [term, setTerm] = useState(urlTerm)
  const debouncedTerm = useDebounce(term, 300)

  // Ultimo termino que ESTA caja mando a la URL. El cambio de URL llega ~300 ms
  // tarde (lo dispara el debounce), y para entonces el usuario puede haber
  // escrito mas. Comparar contra el input actual daria un falso negativo y le
  // borrariamos lo tecleado; comparar contra lo que escribimos nosotros
  // distingue el eco propio de un cambio venido de fuera.
  const lastPushedRef = useRef<string | null>(null)

  const [syncedUrlTerm, setSyncedUrlTerm] = useState(urlTerm)
  if (syncedUrlTerm !== urlTerm) {
    setSyncedUrlTerm(urlTerm)
    if (urlTerm !== lastPushedRef.current) setTerm(urlTerm)
  }

  // Se leen por referencia para que el efecto de navegacion dependa UNICAMENTE
  // del debounce. `navigate` tampoco es estable —react-router lo memoriza con
  // el pathname actual entre sus dependencias—, y como dependencia reejecutaba
  // el efecto en un render donde `debouncedTerm` aun era el termino anterior,
  // reponiendo en la URL un valor ya obsoleto.
  const urlTermRef = useRef(urlTerm)
  urlTermRef.current = urlTerm
  const isOnSearchRef = useRef(isOnSearch)
  isOnSearchRef.current = isOnSearch
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

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
   * Navegacion automatica tras el debounce.
   *
   * La comparacion contra el termino de la URL cubre sola el arranque: montar
   * con `?q=` ya puesto no navega, porque no hay nada que cambiar. Y estando ya
   * en /search se navega con `replace`, de modo que escribir una frase deja una
   * sola entrada en el historial en vez de una por pausa al teclear.
   */
  useEffect(() => {
    const trimmed = debouncedTerm.trim()
    if (trimmed === urlTermRef.current) return

    lastPushedRef.current = trimmed

    if (trimmed.length === 0) {
      // Vaciar la caja limpia los resultados, pero solo si ya se esta en la
      // pantalla de busqueda: borrarla desde el tablero no debe sacar de el.
      if (isOnSearchRef.current) navigateRef.current('/search', { replace: true })
      return
    }

    navigateRef.current(`/search?q=${encodeURIComponent(trimmed)}`, {
      replace: isOnSearchRef.current,
    })
  }, [debouncedTerm])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = term.trim()

    if (trimmed.length === 0) {
      toast.info('Escriba un termino para buscar.')
      return
    }

    // Mismo criterio que el efecto: estando ya en /search se reemplaza la
    // entrada en vez de apilar una nueva por cada envio.
    navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: isOnSearch })
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

            Cada entrada lleva a la pagina propia de la categoria
            (/categories/:id), que ademas del listado aporta el encabezado con
            el conteo de publicaciones y las migas de pan.
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
                      to={`/categories/${category.id}`}
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
