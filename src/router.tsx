import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { RequireAuth, RequireGuest, RequireSuperadmin } from './components/routing/Guards'
import { BoardPage } from './pages/BoardPage'
import { ViewDetailPage } from './pages/ViewDetailPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SearchPage } from './pages/SearchPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { AuthorProfilePage } from './pages/AuthorProfilePage'
import { ViewFormPage } from './pages/ViewFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { CategoryPage } from './pages/CategoryPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage'
import { AdminModerationPage } from './pages/admin/AdminModerationPage'

/**
 * Tabla de rutas de la aplicacion (seccion 5 del enunciado).
 *
 * Todas las rutas cuelgan de <Layout>, que aporta la navbar, el banner de
 * conexion, el pie de pagina y el contenedor de notificaciones. Las paginas de
 * error tambien, porque el enunciado exige que conserven el layout general.
 *
 * Las trece pantallas del enunciado estan implementadas. Cada una se declara
 * bajo el guard que le corresponde: `RequireGuest` para login y registro,
 * `RequireAuth` para lo que exige sesion y `RequireSuperadmin` para el panel de
 * administracion.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* --- Publicas ---------------------------------------------- */}
          <Route index element={<BoardPage />} />

          <Route path="categories/:id" element={<CategoryPage />} />

          <Route path="views/:id" element={<ViewDetailPage />} />

          <Route path="authors/:id" element={<AuthorProfilePage />} />

          <Route path="search" element={<SearchPage />} />

          <Route path="403" element={<ForbiddenPage />} />

          {/* --- Solo para usuarios no autenticados --------------------- */}
          <Route element={<RequireGuest />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* --- Requieren sesion iniciada ------------------------------ */}
          <Route element={<RequireAuth />}>
            <Route path="views/new" element={<ViewFormPage />} />
            <Route path="views/:id/edit" element={<ViewFormPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* --- Requieren rol de superadministrador -------------------- */}
          <Route element={<RequireSuperadmin />}>
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/categories" element={<AdminCategoriesPage />} />
            <Route path="admin/moderation" element={<AdminModerationPage />} />
          </Route>

          {/* --- Comodin: cualquier ruta no declarada ------------------- */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}