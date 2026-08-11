import { useId, type InputHTMLAttributes } from 'react'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /** Mensaje de error del campo — normalmente viene de un 400/422 del API. */
  error?: string
  hint?: string
}

/**
 * Campo de formulario accesible con soporte de error inline.
 *
 * Cumple los tres puntos de accesibilidad que pide el enunciado para
 * formularios: `label` asociado por `id`, `aria-invalid` cuando hay error y
 * `aria-describedby` apuntando al mensaje para que el lector de pantalla lo
 * lea junto al campo.
 */
export function FormField({ label, error, hint, ...inputProps }: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter((value): value is string => value !== null)
    .join(' ')

  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {inputProps.required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>

      <input
        {...inputProps}
        id={id}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />

      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
