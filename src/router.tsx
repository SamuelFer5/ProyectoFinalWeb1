import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth, RequireGuest, RequireSuperadmin } from './components/routing/Guards'
import { BoardPage } from './pages/BoardPage'
import { ViewDetailPage } from './pages/ViewDetailPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

/**
 * Tabla de rutas de la aplicacion (seccion 5 del enunciado).
 *
 * Todas las rutas cuelgan de <Layout>, que aporta la navbar, el banner de
 * conexion, el pie de pagina y el contenedor de notificaciones. Las paginas de
 * error tambien, porque el enunciado exige que conserven el layout general.
 *
 * Las pantallas que aun no existen se declaran contra <PlaceholderPage> en
 * lugar de omitirse: la navbar y las tarjetas del tablero ya enlazan a varias
 * de ellas, y una ruta declarada evita que esos enlaces caigan en el 404.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* --- Publicas ---------------------------------------------- */}
          <Route index element={<BoardPage />} />

          <Route
            path="categories/:id"
            element={
              <PlaceholderPage
                pantalla={6}
                titulo="Pagina de Categoria"
                archivo="src/pages/CategoryPage.tsx"
                descripcion="Publicaciones de una sola categoria, con los mismos filtros y ordenamiento del tablero, encabezado con nombre y descripcion de la categoria, y migas de pan."
              />
            }
          />

          <Route path="views/:id" element={<ViewDetailPage />} />

          <Route
            path="authors/:id"
            element={
              <PlaceholderPage
                pantalla={11}
                titulo="Perfil Publico de Autor"
                archivo="src/pages/AuthorProfilePage.tsx"
                descripcion="Nombre y fecha de registro del autor, mas la grilla de todas sus publicaciones reutilizando ViewCard."
              />
            }
          />

          <Route
            path="search"
            element={
              <PlaceholderPage
                pantalla={13}
                titulo="Resultados de Busqueda"
                archivo="src/pages/SearchPage.tsx"
                descripcion="Resultados de la busqueda global con el termino resaltado, campo editable para refinar y estado vacio descriptivo. El parametro q ya viaja en la URL desde la navbar."
              />
            }
          />

          <Route path="403" element={<ForbiddenPage />} />

          {/* --- Solo para usuarios no autenticados --------------------- */}
          <Route element={<RequireGuest />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* --- Requieren sesion iniciada ------------------------------ */}
          <Route element={<RequireAuth />}>
            <Route
              path="views/new"
              element={
                <PlaceholderPage
                  pantalla={5}
                  titulo="Crear Publicacion"
                  archivo="src/pages/ViewFormPage.tsx"
                  descripcion="Formulario con las dos posturas (minimo 100 caracteres cada una), fuentes dinamicas e independientes por lado, tag input de hashtags y borrador automatico en lasdoscaras_draft."
                />
              }
            />
            <Route
              path="views/:id/edit"
              element={
                <PlaceholderPage
                  pantalla={5}
                  titulo="Editar Publicacion"
                  archivo="src/pages/ViewFormPage.tsx"
                  descripcion="El mismo formulario en modo edicion: carga los datos actuales via GET antes de renderizar. Solo el autor o un superadmin pueden acceder."
                />
              }
            />
            <Route
              path="profile"
              element={
                <PlaceholderPage
                  pantalla={10}
                  titulo="Perfil de Usuario"
                  archivo="src/pages/ProfilePage.tsx"
                  descripcion="Datos del usuario y tres secciones: Mis Publicaciones, Mis Favoritos e Historial (leido de lasdoscaras_history, sin llamadas al API)."
                />
              }
            />
          </Route>

          {/* --- Requieren rol de superadministrador -------------------- */}
          <Route element={<RequireSuperadmin />}>
            <Route
              path="admin/users"
              element={
                <PlaceholderPage
                  pantalla={7}
                  titulo="Admin — Gestion de Usuarios"
                  archivo="src/pages/admin/AdminUsersPage.tsx"
                  descripcion="Tabla paginada de usuarios con busqueda y acciones de banear / desbanear con modal de confirmacion. El superadmin no debe poder banearse a si mismo."
                />
              }
            />
            <Route
              path="admin/categories"
              element={
                <PlaceholderPage
                  pantalla={8}
                  titulo="Admin — Gestion de Categorias"
                  archivo="src/pages/admin/AdminCategoriesPage.tsx"
                  descripcion="CRUD completo de categorias. La eliminacion debe contemplar el 409 cuando la categoria tiene publicaciones asociadas."
                />
              }
            />
            <Route
              path="admin/moderation"
              element={
                <PlaceholderPage
                  pantalla={9}
                  titulo="Admin — Moderacion de Contenido"
                  archivo="src/pages/admin/AdminModerationPage.tsx"
                  descripcion="Tabla de publicaciones con filtro por estado y acciones de despublicar / republicar, actualizando la fila sin recargar la pagina."
                />
              }
            />
          </Route>

          {/* --- Comodin: cualquier ruta no declarada ------------------- */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
