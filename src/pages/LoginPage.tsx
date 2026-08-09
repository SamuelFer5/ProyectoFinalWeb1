import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '../components/ui/FormField'
import { Spinner } from '../components/ui/States'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { isApiError } from '../models'
import { toFieldErrors, toUserMessage } from '../utils/errors'
import type { FieldErrors } from '../models'

interface LocationState {
  from?: { pathname: string }
}

/**
 * Pantalla 3 — Inicio de sesion.
 *
 * Tras autenticar, el AuthProvider persiste la sesion y sincroniza los
 * favoritos del usuario; aqui solo queda devolver al usuario a la ruta que
 * intentaba visitar antes de que el guard lo interceptara.
 */
export function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setFieldErrors({})
    setGlobalError(null)

    // Validacion de cliente antes de gastar una llamada al API.
    const errors: FieldErrors = {}
    if (!email.trim()) errors.email = 'El correo es obligatorio.'
    if (!password) errors.password = 'La contrasena es obligatoria.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      toast.success('Bienvenido de vuelta')
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFieldErrors(toFieldErrors(error))

      // El enunciado pide distinguir credenciales invalidas (401) de cuenta
      // baneada (403) con mensajes especificos, no un error generico.
      //
      // El 403 del API cubre DOS situaciones distintas —cuenta suspendida y
      // cuenta sin activar— y el mensaje ya viene diferenciado y traducido
      // desde la capa HTTP, asi que aqui se respeta tal cual en lugar de
      // aplastar ambas con un texto unico.
      if (isApiError(error) && error.status === 401) {
        setGlobalError('Correo o contrasena incorrectos.')
      } else if (isApiError(error) && error.status === 403) {
        setGlobalError(error.message)
      } else {
        setGlobalError(toUserMessage(error, 'No fue posible iniciar sesion.'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Iniciar sesion</h1>
        <p className="auth-card__lead">
          Acceda para reaccionar a las posturas, guardar favoritos y publicar sus propios temas.
        </p>

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          noValidate
        >
          {globalError ? (
            <p className="form-error" role="alert">
              {globalError}
            </p>
          ) : null}

          <FormField
            label="Correo electronico"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            error={fieldErrors.email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
          />

          <div className="password-field">
            <FormField
              label="Contrasena"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              error={fieldErrors.password}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
            />
            <button
              type="button"
              className="password-field__toggle"
              onClick={() => {
                setShowPassword((current) => !current)
              }}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {/* Deshabilitado durante el envio: previene el doble submit. */}
          <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Iniciando sesion" /> : null}
            {isSubmitting ? 'Iniciando sesion...' : 'Iniciar sesion'}
          </button>
        </form>

        <p className="auth-card__switch">
          No tiene cuenta? <Link to="/register">Registrese aqui</Link>
        </p>
      </div>
    </div>
  )
}
