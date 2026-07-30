<p align="center">
  <img src="docs/banner.svg" alt="Team Builder LOL" width="600" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/WebSocket-real--time-8B5CF6" alt="WebSocket" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

<h1 align="center">Team Builder LOL</h1>

<p align="center">
  Plataforma colaborativa para armar composiciones de <strong>League of Legends</strong>.<br/>
  Draft simulator en tiempo real, pizarra táctica, sustitutos por rol y análisis de composiciones.
</p>

---

## Caracteristicas

- **Simulador de Draft** — 20 pasos de picks/bans con fases correctas (Blue/Red alternado), sincronizado en tiempo real via WebSocket
- **Composiciones con Sustitutos** — Cada rol puede tener campeones sustitutos. Si banean tu main, la composicion sigue viva con el sustituto (indicado con borde morado en el draft)
- **Pizarra Tactica** — Canvas colaborativo por composicion: arrastra notas, pega iconos de campeones, redimensiona, todo en tiempo real
- **Voto Multiple** — Los espectadores pueden votar por varias composiciones simultaneamente
- **Sesiones Activas** — Side selector con lista de drafts en vivo (Azul/Rojo)
- **Filtro inteligente** — Las composiciones se filtran automaticamente segun bans, picks enemigos y picks propios

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| Base de datos | MySQL + Prisma 7 |
| Tiempo real | WebSocket (ws) en puerto 3006 |
| Autenticacion | JWT via Riot ID (sin password) |
| Build | Webpack (Turbopack bug en Next 16) |

## Instalacion

### Requisitos

- Node.js 20+
- MySQL 8+
- npm

### 1. Clonar

```bash
git clone https://github.com/AngelDAL/team-builder-lol.git
cd team-builder-lol
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar entorno

Crea un archivo `.env` en la raiz:

```env
DATABASE_URL="mysql://usuario:password@localhost:3306/lol_team_builder"
JWT_SECRET="tu-secreto-aqui"
```

### 4. Base de datos

```bash
npx prisma generate
npx prisma db push
```

### 5. Seed de campeones (opcional)

```bash
curl http://localhost:3005/api/champions/seed
```

### 6. Iniciar servidores

```bash
# Terminal 1 - WebSocket server
node server/ws-server.js

# Terminal 2 - Next.js (desarrollo)
npm run dev

# o Next.js (produccion)
npm run build
npm start
```

La app corre en:
- **Web:** `http://localhost:3005`
- **WS:** `ws://localhost:3006`

## Uso

### Crear una composicion

1. Ve a `/compositions/new`
2. Asigna un campeon por rol (Top, Jungla, Mid, ADC, Soporte)
3. Ponle nombre y guardala

### Agregar sustitutos

1. Abre la composicion en `/compositions/[id]`
2. En cada slot, click en **"+ Agregar sustituto"**
3. Busca el campeon y seleccionalo
4. Repite para agregar multiples sustitutos por rol

### Simular un draft

1. Ve a `/simulador`
2. Selecciona tu lado (Azul o Rojo) — o unete como espectador
3. Sigue los 20 pasos de picks/bans
4. Las composiciones vivas se muestran a la derecha
5. Si un campeon principal esta baneado y hay sustituto, se muestra con **borde morado**

### Usar la pizarra tactica

1. Abre una composicion en `/compositions/[id]`
2. Baja hasta **"Pizarra Tactica"**
3. **Agregar Nota:** escribe estrategias, recordatorios
4. **Agregar Campeon:** busca y pega iconos de campeones
5. Arrastra para mover, esquinas para redimensionar
6. Todo se sincroniza en tiempo real — abre 2 pestañas y velo

### Votar como espectador

1. Entra a un draft activo como espectador
2. Haz click en las composiciones para votar
3. Puedes votar por **varias** composiciones a la vez

## Screenshots

<p align="center">
  <img src="docs/screenshots/draft-simulator.png" alt="Draft Simulator" width="400" />
  <img src="docs/screenshots/composition-detail.png" alt="Composition Detail" width="400" />
  <img src="docs/screenshots/whiteboard.png" alt="Tactical Whiteboard" width="400" />
  <img src="docs/screenshots/composition-list.png" alt="Composition List" width="400" />
</p>

> Para agregar screenshots reales, guarda las imagenes en `docs/screenshots/` con los nombres arriba indicados. Toma capturas de:
> - `/simulador` — el draft en progreso con composiciones vivas/muertas
> - `/compositions/[id]` — detalle con pizarra tactica
> - `/compositions` — lista de composiciones con badges de sustitutos

## API

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registro via Riot ID |
| `POST` | `/api/auth/login` | Login, devuelve JWT |
| `GET` | `/api/champions` | Lista de campeones |
| `GET/POST` | `/api/compositions` | Listar/crear composiciones |
| `GET/PATCH/DELETE` | `/api/compositions/[id]` | Detalle de composicion |
| `POST/DELETE` | `/api/compositions/[id]/substitutes` | Agregar/quitar sustitutos |
| `GET/POST` | `/api/compositions/[id]/whiteboard` | Pizarra (elementos) |
| `PATCH/DELETE` | `/api/compositions/[id]/whiteboard/[eid]` | Editar/borrar elemento |
| `POST` | `/api/compositions/[id]/whiteboard/lock` | Bloquear elemento |

## WebSocket

Conectar a `ws://localhost:3006`. Mensajes principales:

| Tipo | Direccion | Descripcion |
|------|-----------|-------------|
| `auth` | → | Autenticar con JWT |
| `draft_create` | → | Crear sesion de draft |
| `draft_join` | → | Unirse como espectador |
| `draft_update` | → | Actualizar estado del draft |
| `draft_vote` | → | Votar por composicion |
| `wb:add` | → | Agregar elemento a pizarra |
| `wb:move` | → | Mover elemento (arrastre) |
| `wb:update` | → | Actualizar elemento |
| `wb:lock` | → | Bloquear para edicion |

## Estructura del proyecto

```
src/
  app/
    (protected)/
      simulador/       # Draft simulator
      compositions/    # CRUD de composiciones
      dashboard/       # Panel principal
    api/
      compositions/    # API REST composiciones
      auth/            # Auth endpoints
      champions/       # Datos de campeones
      admin/           # Utilidades de migracion
  components/
    WhiteboardPanel.tsx   # Pizarra tactica
    CompositionNotes.tsx  # Notas (legacy, migradas)
    CompCard.tsx          # Tarjeta de composicion
    NavBar.tsx            # Barra de navegacion
  hooks/
    useWebSocket.ts       # Hook generico WS
    useDraftWebSocket.ts  # Hook especifico draft
  lib/
    draft.ts              # Logica de filtrado + pasos
    prisma.ts             # Cliente Prisma
    auth.ts               # JWT helpers
    middleware.ts          # Auth middleware
server/
  ws-server.js            # Servidor WebSocket
prisma/
  schema.prisma           # Modelo de datos
```

## Licencia

MIT — haz lo que quieras, solo no digas que es tuyo.

---

<p align="center">
  Hecho con 🎮 por <a href="https://github.com/AngelDAL">AngelDAL</a> y Koki
</p>
