# Pendientes

App personal de gestión de pendientes con metodología GTD. PWA instalable, funciona offline, sin tokens, sin costos.

## Probarla ya mismo

Abrí `index.html` haciendo doble click. Se abre en el navegador y funciona. Los datos se guardan en localStorage del browser.

> Tip: la primera vez carga 8 tareas de ejemplo para que veas cómo funciona. Las podés borrar todas desde el menú de configuración (⚙) → "Borrar todo".

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `⌘N` o `N` | Nueva tarea |
| `⌘K` o `/` | Buscar |
| `⌘1` | Inbox |
| `⌘2` | Hoy |
| `⌘3` | Próximo |
| `⌘4` | Algún día |
| `⌘5` | Logbook |
| `↑` `↓` | Navegar tareas |
| `Space` | Completar tarea seleccionada |
| `Backspace` | Eliminar tarea seleccionada |
| `Esc` | Cerrar modal / panel |

## Quick add con parsing natural

Al crear una tarea (con `N`), podés escribir todo en una línea:

- `Mandar oferta a Lucas !alta @plutto +hiring mañana`
- `Llamar al dentista @personal vie`
- `Revisar deck #urgente !alta hoy`

Operadores:
- `@area` — asigna área (ej: `@plutto`, `@personal`)
- `+proyecto` — asigna proyecto (ej: `+hiring`)
- `!alta` `!media` `!baja` — prioridad
- `#tag` — agrega un tag
- Fechas: `hoy`, `mañana`, `lunes`/`martes`/etc, `próxima semana`, `en 3 días`, `el 15/5`

## Deploy a Vercel (para usar en celu)

Tu PWA local funciona perfecto, pero si querés instalarla como app en el celu y que sincronice, conviene desplegarla:

### Opción 1: Drag & drop (más rápido, 2 min)

1. Andá a https://vercel.com/new
2. Arrastrá la carpeta `outputs/` (con todos estos archivos) al área "Deploy"
3. Click en "Deploy"
4. Te da una URL tipo `pendientes-xxx.vercel.app`
5. Abrila en el celu desde Safari/Chrome
6. **iOS**: Compartir → "Agregar a pantalla de inicio"
7. **Android**: menú ⋮ → "Instalar app"

### Opción 2: Desde GitHub (recomendado para iterar)

```bash
# En tu compu, dentro de la carpeta:
cd outputs
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Creá un repo en GitHub (privado), después:
git remote add origin https://github.com/TU-USUARIO/pendientes.git
git push -u origin main
```

Después en Vercel:
1. Andá a https://vercel.com/new
2. Conectá el repo de GitHub
3. Click "Deploy" — sin builds, sin config, es estático
4. Cada `git push` actualiza la app automáticamente

### ¿Voy a tener problemas con el free tier?

**No.** Es un sitio estático de < 60 KB, se cachea como PWA en cada device. En el plan Hobby de Vercel:
- 100 GB bandwidth/mes (sobra 100x)
- Builds ilimitados
- N proyectos por cuenta
- Sin serverless functions = sin cuota de compute

La única letra chica del Hobby es "no commercial use". Para una app personal no aplica. Si tu cuenta de Vercel está conectada a Plutto, podés crear una cuenta personal aparte (gratis) o deployarla en la cuenta del trabajo (todavía dentro de límites Hobby).

## Datos

- **Persistencia**: localStorage del navegador. Los datos viven en cada device por separado (laptop tiene los suyos, celu los suyos).
- **Backup**: ⚙ → "Exportar a JSON" descarga un archivo con todo. ⚙ → "Importar JSON" lo restaura.
- **Sincronización entre devices** (V2 opcional): Se puede agregar Supabase free tier (500 MB DB gratis). Avisame si querés sumar esto.

## Sumar en V2 (si te queda gusto a poco)

- Sync entre laptop y celu via Supabase (gratis)
- Recordatorios push del browser
- Tareas recurrentes (cada lunes, todos los meses, etc.)
- Vista calendario / time-blocking
- Integración con Google Calendar
- Atajo global Cmd+Shift+T desde cualquier app (esto requiere extension nativa)
- Drag & drop entre vistas

## Estructura de archivos

```
outputs/
├── index.html       # UI completa (HTML + CSS)
├── app.js           # Lógica completa
├── manifest.json    # PWA manifest
├── sw.js            # Service worker (offline)
├── icon.svg         # Ícono vectorial
├── icon-192.png     # Ícono 192x192 (Android)
├── icon-512.png     # Ícono 512x512 (Android, splash)
└── README.md        # Este archivo
```

Todo es vanilla JS, sin frameworks ni build step. Editás un archivo y refrescás el browser.
