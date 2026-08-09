import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormField } from '../components/ui/FormField'
import { Spinner } from '../components/ui/States'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { isApiError } from '../models'
import { toFieldErrors, toUserMessage } from '../utils/errors'
import type { FieldErrors } from '../models'

/** Fuerza de la contrasena, calculada solo para retroalimentacion visual. */
function passwordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (password.length < 8) return { score: 0, label: 'Muy corta' }

  let score = 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++

  const labels = ['Muy corta', 'Debil', 'Aceptable', 'Fuerte'] as const
  const clamped = Math.min(score, 3) as 0 | 1 | 2 | 3
  return { score: clamped, label: labels[clamped] }
}

/**
 * Pantalla 2 — Registro de usuario.
 *
 * Toda la validacion de formato ocurre en el cliente antes de enviar; el API
 * sigue siendo la autoridad sobre la unicidad del correo, que llega como 409 y
 * se pinta inline en el campo correspondiente.
 */
export function RegisterPage() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const strength = useMemo(() => passwordStrength(password), [password])

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}

    if (nombre.trim().length < 3) {
      errors.nombre = 'El nombre debe tener al menos 3 caracteres.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Ingrese un correo electronico valido.'
    }
    if (password.length < 8) {
      errors.password = 'La contrasena debe tener al menos 8 caracteres.'
    }
    // Comparacion en cliente: el API no recibe el campo de confirmacion.
    if (confirm !== password) {
      errors.confirm = 'Las contrasenas no coinciden.'
    }

    return errors
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setGlobalError(null)
    const errors = validate()

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)

    try {
      await register({ nombre: nombre.trim(), email: email.trim(), password })
      toast.success('Cuenta creada correctamente')
      // Si el API devolvio token, el guard de invitado ya habra redirigido al
      // tablero; si no, se envia al login para confirmar credenciales.
      navigate('/login', { replace: true })
    } catch (error) {
      const apiFieldErrors = toFieldErrors(error)

      if (isApiError(error) && error.status === 409) {
        // 409 = correo duplicado: mensaje inline en el campo, no un toast suelto.
        setFieldErrors({
          ...apiFieldErrors,
          email: apiFieldErrors.email ?? 'El correo ya esta registrado.',
        })
      } else {
        setFieldErrors(apiFieldErrors)
        setGlobalError(toUserMessage(error, 'No fue posible crear la cuenta.'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="auth-card__lead">
          Unase a LasDosCaras para aportar posturas, contrapunto y fuentes verificables.
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
            label="Nombre completo"
            type="text"
            name="nombre"
            autoComplete="name"
            required
            value={nombre}
            error={fieldErrors.nombre}
            onChange={(event) => {
              setNombre(event.target.value)
            }}
          />

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

          <FormField
            label="Contrasena"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            hint="Minimo 8 caracteres."
            error={fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
          />

          {password.length > 0 ? (
            <div className="strength" aria-live="polite">
              <div className={`strength__bar strength__bar--${strength.score}`} />
              <span className="strength__label">Seguridad: {strength.label}</span>
            </div>
          ) : null}

          <FormField
            label="Confirmar contrasena"
            type="password"
            name="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            error={fieldErrors.confirm}
            onChange={(event) => {
              setConfirm(event.target.value)
            }}
          />

          <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Creando cuenta" /> : null}
            {isSubmitting ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p className="auth-card__switch">
          Ya tiene cuenta? <Link to="/login">Inicie sesion</Link>
        </p>
      </div>
    </div>
  )
}
