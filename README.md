# LasDosCaras — Frontend

Aplicación web de una sola página (SPA) que presenta siempre **las dos narrativas de cada
tema**: cada publicación tiene una *Postura* (Lado A) y una *Contrapostura* (Lado B), cada
una con su propio título, argumento, fuentes de referencia y contadores de reacciones
completamente independientes.

Proyecto Integrador Final — **ISW-521 Programación en Ambiente Web I**
Universidad Técnica Nacional · II Cuatrimestre 2026 · Prof. Bladimir Arroyo B.

## Integrantes

| Integrante | Correo |
| --- | --- |
| Alejandro Corrales Rivera | alejandrocorrales2105@gmail.com |
| Samuel Fernández | fernandezsamuel989@gmail.com |

## Stack

| Pieza | Tecnología |
| --- | --- |
| Framework | React 19 + React Router 7 |
| Lenguaje | TypeScript en modo `strict`, sin `any` |
| Build | Vite 8 |
| Estilos | CSS3 propio con variables, *mobile-first* |
| Linter | Oxlint |
| Backend | `doscarasapi` (Express + Prisma + PostgreSQL + JWT) — insumo del curso, **no se modifica** |

---

## Cómo ejecutar el proyecto

### 1. Levantar el API

El API vive en `../ProyectoFinal/doscarasapi`. La vía más corta es Docker, que levanta
PostgreSQL y el API juntos, aplica las migraciones y siembra categorías y el superadmin:

```bash
cd ../ProyectoFinal/doscarasapi
docker compose up -d --build      # http://localhost:3000
```

Verificación rápida:

```bash
curl http://localhost:3000/health          # {"status":"ok"}
curl http://localhost:3000/api/categories  # {"categories":[...]}
```

Si `categories` viene vacío, ejecute la siembra manualmente:

```bash
docker compose exec api npx prisma db seed
```

Credenciales del superadministrador sembrado: `admin@doscaras.dev` / `ChangeMe123!`.

<details>
<summary>Alternativa sin Docker</summary>

Requiere PostgreSQL instalado localmente:

```bash
cd ../ProyectoFinal/doscarasapi
npm install
cp doscaras/.env.example .env     # editar DATABASE_URL, JWT_SECRET, SUPERADMIN_*
npx prisma migrate dev
npx prisma db seed
npm run dev
```
</details>

### 2. Levantar el frontend

```bash
npm install
cp .env.example .env    # la URL por defecto ya apunta al API local
npm run dev             # http://localhost:5173
```

Otros comandos: `npm run build` (typecheck + bundle de producción), `npm run preview`,
`npm run lint`.

### Variables de entorno

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `VITE_API_URL` | URL base del REST API, **incluyendo el prefijo `/api`** | `http://localhost:3000/api` |

`.env` está en `.gitignore`; `.env.example` se versiona con todas las variables necesarias.

---

## Estado de las pantallas

| # | Pantalla | Ruta | Estado |
| --- | --- | --- | --- |
| 1 | Tablero principal | `/` | ✅ Completa |
| 2 | Registro | `/register` | ✅ Completa |
| 3 | Inicio de sesión | `/login` | ✅ Completa |
| 4 | Detalle de publicación | `/views/:id` | ✅ Completa |
| 12 | Error 404 / 403 | `/*`, `/403` | ✅ Completa |
| 6 | Página de categoría | `/categories/:id` | ⏳ Pendiente |
| 5 | Crear / editar publicación | `/views/new`, `/views/:id/edit` | ⏳ Pendiente |
| 10 | Perfil de usuario | `/profile` | ⏳ Pendiente |
| 11 | Perfil público de autor | `/authors/:id` | ⏳ Pendiente |
| 13 | Resultados de búsqueda | `/search` | ⏳ Pendiente |
| 7–9 | Paneles de superadmin | `/admin/*` | ⏳ Pendiente |

Las pantallas pendientes tienen su ruta declarada y protegida por el guard que les
corresponde, apuntando a un marcador que indica qué archivo hay que crear. La capa de
servicio de todas ellas ya está implementada y tipada.

## Capturas

| Tablero principal | Detalle con las dos caras |
| --- | --- |
| ![Tablero](docs/capturas/tablero.png) | ![Detalle](docs/capturas/detalle.png) |

| Registro | Modo oscuro y sin conexión |
| --- | --- |
| ![Registro](docs/capturas/registro.png) | ![Sin conexión](docs/capturas/modo-oscuro-sin-conexion.png) |

<details>
<summary>Vista móvil (390 px)</summary>

![Detalle en móvil](docs/capturas/movil-detalle.png)
</details>

---

## Arquitectura

```
src/
├── models/          Modelos de dominio (español) + dto.ts (formas crudas del API)
├── services/        Única capa que habla con el API. Ningún componente llama a fetch
│   ├── http.ts          Cliente central: JWT, timeouts, reintento, traducción de errores
│   ├── mappers.ts       Frontera DTO -> dominio
│   ├── cache.service.ts Único acceso a localStorage
│   └── *.service.ts     auth, catalog, views, favorites, authors, history
├── context/         Estado global: sesión (useReducer), notificaciones, tema
├── hooks/           useAuth, useToast, useTheme, useDebounce, useOnlineStatus
├── components/      layout/, routing/ (guards), ui/, views/
├── pages/           Una pantalla por archivo
└── styles/          tokens (temas) → base → components → layout
```

### Traducción entre el API y el dominio

El API es un insumo fijo del curso y **no se modifica**. Su modelo está en inglés y sigue
la forma de Prisma; el enunciado describe el dominio en español y con `ladoA` / `ladoB`
explícitos. Toda la conversión se concentra en `models/dto.ts` + `services/mappers.ts`:

| Dominio (enunciado) | API real | Nota |
| --- | --- | --- |
| `View.ladoA` / `View.ladoB` | `sides[]` con `type: 'SIDE'` / `'COUNTERPART'` | |
| `View.titulo` | *no existe* | Se deriva del título de la Postura: el API no guarda un título por publicación |
| `Side.likes` / `dislikes` | `likeCount` / `dislikeCount` | Por cara, filas distintas en `view_sides` |
| `Side.miReaccion` | `myReaction` | Solo llega si la petición viaja con JWT |
| `Source.titulo` | `label` (opcional) | Sin `label` se muestra la URL |
| `Category.activo` | `deletedAt === null` | El API usa borrado lógico |
| `Category.descripcion` | *no existe* | Queda vacía |
| `User.rol` / `estado` | `role` / `status` | `PENDING` se expone como `pendiente` |
| `Paginated.totalPages` | `total` + `limit` | Se calcula en el cliente |
| Favoritos del usuario | `{ favorites: string[] }` | Solo IDs, no publicaciones completas |
| `Comment.moderado` | *no existe* | El API no expone moderación; queda en `true` |

### Registro en tres pasos

`POST /auth/register` **no devuelve token**: crea la cuenta en estado `PENDING` y entrega un
`activationToken` en la respuesta. Sin activarla, `POST /auth/login` responde **403 "Account
is pending activation"**. Como el API no envía correos, el cliente encadena
`register → GET /auth/activate/:token → login`, de modo que el usuario termina el
formulario ya autenticado (`context/AuthProvider.tsx`).

### Manejo de errores

`services/http.ts` es el único lugar donde se llama a `fetch`. Traduce cada respuesta a un
`ApiError` tipado con `status`, `message` en español y `fieldErrors` para pintar inline:

| Código | Comportamiento |
| --- | --- |
| 400 / 422 | Errores por campo mapeados al input; el mensaje del API se traduce |
| 401 | Limpia la sesión, borra el token y avisa "Su sesión ha expirado" |
| 403 | Muestra el motivo real (sin permisos / cuenta suspendida / sin activar). **No** redirige al login |
| 404 | Mensaje contextual: "Esta publicación no existe o fue eliminada" |
| 409 | Inline en el campo — p. ej. "El correo ya está registrado" |
| 5xx | Mensaje genérico al usuario + `console.error` para depuración |
| Red / timeout | Un reintento automático en los GET antes de mostrar el error |

El API responde en inglés (`{ "error": "Email is already registered" }`) y con la validación
de Zod agrupada bajo `details.fieldErrors.body`; ambas cosas se normalizan en `http.ts`.

### Datos que persiste la aplicación (`localStorage`)

Todo pasa por `services/cache.service.ts`; ningún componente toca `localStorage`
directamente. Cada entrada se guarda envuelta como `{ value, timestamp }` para poder
validar su TTL en la lectura.

| Clave | TTL | Por qué se persiste |
| --- | --- | --- |
| `lasdoscaras_auth` | Hasta logout o 401 | Restaurar la sesión al recargar sin volver a pedir credenciales |
| `lasdoscaras_categories` | 1 hora | Los filtros del tablero deben existir antes de que el API conteste |
| `lasdoscaras_hashtags` | 30 minutos | Sugerencias de autocompletado sin llamada extra |
| `lasdoscaras_filters` | Permanente | El usuario reencuentra el tablero como lo dejó |
| `lasdoscaras_favorites` | Sincronizado al login | Pintar el corazón correcto en el primer render |
| `lasdoscaras_draft` | Hasta publicar o descartar | No perder un formulario largo a medio escribir |
| `lasdoscaras_theme` | Permanente | Se aplica en `index.html` **antes** del primer render (sin FOUC) |
| `lasdoscaras_history` | Permanente (FIFO, 20) | Historial de publicaciones vistas sin consultar el API |
| `lasdoscaras_board` | Sin TTL | Instantánea del último tablero, para el modo sin conexión |

**No se persiste nada sensible.** La contraseña nunca se guarda. El JWT sí vive en
`localStorage`: es vulnerable a XSS, y la alternativa más segura sería una cookie
`httpOnly`, pero el API la tendría que emitir y no lo hace. La mitigación es que el token
expira (`JWT_EXPIRES_IN`, 7 días por defecto) y que cualquier 401 lo borra de inmediato.

---

## Limitaciones conocidas

1. **Ordenar por likes de una cara concreta.** El enunciado pide ordenar por "más likes
   Lado A / Lado B", pero el API solo ordena por la **suma** de ambas caras
   (`sort=likes|dislikes|recent`). Se le pide el orden por likes totales y la página
   recibida se reordena en el cliente por la cara elegida: el orden es exacto dentro de la
   página. Resolverlo del todo exigiría un parámetro nuevo en el API.
2. **Filtro por hashtag.** `GET /views` acepta **un** hashtag por consulta, no una lista;
   el panel de filtros reemplaza el hashtag activo en vez de acumular varios.
3. **Descripción de categorías.** El modelo `Category` del API no tiene el campo.
4. **Moderación de comentarios.** El API no expone estado de moderación; la advertencia se
   muestra y el indicador "en moderación" queda listo para cuando el campo exista.
5. **Búsqueda global.** `GET /search` devuelve las caras recortadas (sin descripción ni
   contadores) y sin paginación; las tarjetas de resultados muestran contadores en cero.
6. **Menú de categorías de la navbar.** Lleva al tablero filtrado (`/?category=`) en vez de
   a `/categories/:id`, porque la Pantalla 6 todavía no está construida. Cuando exista,
   solo cambia el destino del enlace en `components/layout/Navbar.tsx`.

## Decisiones de diseño que conviene poder defender

- **La URL es la única fuente de verdad de los filtros del tablero.** `BoardPage` los
  deriva de `useSearchParams` en cada render en lugar de duplicarlos en `useState`. Así,
  un enlace entrante, el menú de categorías, el botón Atrás del navegador y un enlace
  compartido se comportan todos igual. Con estado propio, un enlace `/?category=X` no
  tenía efecto si el tablero ya estaba montado.
- **Los filtros se persisten en la acción del usuario, no en un efecto.** Un efecto sobre
  `filters` también se dispararía en el primer render con los valores por defecto y
  borraría las preferencias guardadas.
- **`SidePanel` recibe un único `Side` y no conoce la otra cara.** Es la garantía
  estructural de que los contadores de Lado A y Lado B no pueden compartir estado.
- **El menú de categorías usa `<details>/<summary>`.** El navegador aporta gratis el
  estado abierto/cerrado, el foco y la operación por teclado que exige la accesibilidad.

## Convenciones de trabajo

- Ramas por funcionalidad (`feature/...`), integración vía Pull Request a `develop` y de
  ahí a `main`.
- Mensajes de commit convencionales: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`.
