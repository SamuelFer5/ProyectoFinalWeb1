/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del REST API, incluyendo el prefijo /api. */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
