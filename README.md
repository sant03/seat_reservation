# Reserva Bus — Asamblea de Circuito

Aplicación web para llevar las reservas de cupos en el bus de una asamblea de circuito de 3 días. El estado vive en el archivo Excel original (hoja `Arreglo Bus`) y cada guardado en producción queda registrado como un *commit* en un repositorio de GitHub (historial completo, 1 commit por guardado).

- **Frontend**: Angular 22 + Angular Material (en `frontend/`).
- **Backend**: Node.js + Express + ExcelJS (en `backend/`) — lee/escribe el Excel y lo sirve como API.
- El propio backend sirve el frontend ya compilado en el mismo dominio (deploy de **un solo servicio**).

## Requisitos locales

- Node.js ≥ 20 (probado con Node 24 LTS).
- Windows: usar `npm.cmd` / `npx.cmd` si `npm.ps1` está bloqueado por la política de ejecución.

## Qué hace la app

- **Dashboard**: totales por día (puestos usados vs. capacidad, recaudado, pendiente) con barras de estado.
- **Reservas**: tabla con nombre, puestos/estado por día (Pagado · Abono · Pendiente · Cancelado), totales y acciones. Alta, edición, baja y filtros.
- **Configuración**: capacidad del bus (por defecto 45), valor del cupo (por defecto $15.000), fechas de los 3 días, tareas/notas, **descarga del Excel actualizado** e **historial de versiones** (las versiones del archivo; la app puede cargar una versión anterior y guardarla).
- Regla de negocio: la suma de puestos del día (sin contar cancelados) no puede exceder la capacidad configurada (validado en backend y en la UI).
- Cada guardado escribe el Excel de nuevo (totalizadores con `SUM()`, hoja `Config` con capacitación/valores/fechas, sección TAREAS) y, en producción, hace 1 commit en GitHub.

## Arranque local

### 1) Backend

```bash
cd backend
npm install
copy .env.example .env      # por defecto: filesystem, guarda en data/ListadoBus.xlsx
node src/index.js
```

La API queda en `http://localhost:3000` (health, model, dashboard, history, export).

### 2) Frontend

```bash
cd frontend
npm install
npm run build               # genera dist/frontend/browser
```

El backend ya sirve esa carpeta compilada en `http://localhost:3000` (SPA completa + API en el mismo origen).

Para desarrollo con recarga en caliente:

```bash
cd frontend
npm run start               # ng serve en http://localhost:4200 (configura environment.ts -> localhost:3000)
```

## Configuración (variables de entorno del backend)

| Variable | Uso | Default |
| --- | --- | --- |
| `PORT` | Puerto HTTP | `3000` |
| `STORAGE_TYPE` | `filesystem` (local) o `github` (producción) | `filesystem` |
| `FS_FILE_PATH` | Ruta local del Excel (modo local) | `data/ListadoBus.xlsx` |
| `GITHUB_TOKEN` | Token PAT (modo github) | — |
| `GITHUB_OWNER` | Dueño del repo (usuario u organización) | — |
| `GITHUB_REPO` | Nombre del repositorio | — |
| `GITHUB_BRANCH` | Rama a usar | `main` |
| `GITHUB_FILE_PATH` | Ruta del archivo dentro del repo | `datos/ListadoBus.xlsx` |

## Despliegue (un solo servicio en Render)

1. **Repositorio GitHub**: crea un repo (público o privado). Sube el Excel **original y sin modificar** a la ruta `datos/ListadoBus.xlsx` en la rama `main` — ese será el punto de partida del historial.

2. **Token GitHub**: genera un PAT con alcance `repo` (fine/settings → Developer settings → Personal access tokens). Lo guardas después como secreto en Render.

3. **Render** (cuenta gratis): *New → Web Service*, conectar el repo, y configurar:

   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Environment variables**:
     - `STORAGE_TYPE=github`
     - `GITHUB_TOKEN=<el PAT>`
     - `GITHUB_OWNER=<tu usuario>`
     - `GITHUB_REPO=<nombre del repo>`
     - `GITHUB_BRANCH=main`
     - `GITHUB_FILE_PATH=datos/ListadoBus.xlsx`

4. **Frontend**: el servicio de Render ya sirve el frontend compilado **solo si existe `frontend/dist/frontend/browser`**. Render no lo compila por defecto. Opciones:

   - **Recomendada**: agrega al Build Command del backend `npm install && cd ../frontend && npm install && npm run build && cd ..` (así Render compila el frontend y el backend lo sirve en la misma URL). Ejemplo:
     > Root Directory: `backend` no es compatible con ese comando; mejor usar Root Directory: raíz del repo y Build Command: `cd backend && npm install && cd ../frontend && npm install && npm run build && cd ..`, Start Command: `cd backend && node src/index.js`.
   - Alternativa: compilar el frontend en tu CI y subir `dist` como otro servicio estático; ajusta `frontend/src/environments/environment.prod.ts` con la URL del backend (`apiUrl`).

   > Nota: con la opción recomendada, `environment.ts` (`http://localhost:3000`) no se usa porque el frontend se sirve en el mismo dominio que la API (mismo origen); cambia a `/` si vieras llamadas fallando.

5. Verifica el historial en `https://<tu-servicio>.onrender.com/history` — la primera versión será el Excel que subiste al repo y cada guardado agregará un commit.

## Notas importantes

- **No edites el Excel manualmente** mientras corre la app: el backend sobrescribe el archivo en cada guardado. Si editas con Excel y luego guardas por la app, se pierde lo manual.
- El adaptador "aplana" las fórmulas del Excel original (fórmulas compartidas de Excel para Mac rompían la reescritura con ExcelJS). La app recalcula totales y los escribe como fórmulas `SUM()` estándar.
- La sección TAREAS del Excel (fila ~42) se sincroniza con la pestaña Configuración.
- Estado/economicidad: cada guardado = 1 commit en GitHub → puedes volver a cualquier versión anterior desde Configuración → Historial.
- Recomendado: respaldo del Excel original y del repo de vez en cuando.

## Estructura

```
backend/
  data/ListadoBus.xlsx        copia local de desarrollo
  src/config.js               variables de entorno
  src/excel/fields.js         layout del Excel (columnas, días, estados, defaults)
  src/excel/service.js        lectura/escritura del archivo con ExcelJS
  src/storage/                filesystem.js | github.js | index.js
  src/routes/                 model, dashboard, history
  src/index.js                API + sirve frontend compilado
frontend/
  src/app/                    dashboard, reservas, reserva-form, config, services, utils
  src/environments/           API URL (dev/prod)
```