# web/ — Frontend (Fase 5)

Frontend de Garrón. **Estado:** interfaz mapeada pixel a pixel contra el diseño,
sin funcionalidad real todavía (datos estáticos) y sin deploy a Vercel.

## Stack

- **Next.js 14 (App Router)** + TypeScript
- **Tailwind CSS** con design tokens propios (`tailwind.config.ts`)
- **shadcn/ui** (patrón): primitivos copiados a `components/ui/` (`Button`, `Input`, `Card`)
- **lucide-react** para íconos
- **framer-motion** para los reveals escalonados y la transición de la ficha
- **Inter** vía `next/font` (self-hosted, sin CLS)

## Estructura

```
app/
├─ layout.tsx          fuente Inter + metadata
├─ globals.css         base Tailwind
├─ page.tsx            Home (Imagen #1): inicio guiado por categorías
└─ resultado/page.tsx  Ficha (Imagen #2): qué te corresponde / fundamento / cómo reclamar
components/
├─ logo.tsx            isotipo (burbuja + check) + wordmark
├─ source-badge.tsx    sello de fuente oficial
└─ ui/                 Button, Input, Card
lib/
├─ utils.ts            cn() (clsx + tailwind-merge)
└─ demo-data.ts        datos estáticos que ESPEJAN el contrato de la Edge Function
```

## Correr

`web/` es un **workspace npm** del monorepo. Las dependencias se instalan una sola
vez desde la raíz y comparten `node_modules` con el resto del repo.

```bash
# desde la RAÍZ del repo
npm install            # instala todos los workspaces de una
npm run dev            # = npm run dev -w web  → http://localhost:3000
npm run build:web      # build de producción del frontend

# o directamente sobre el workspace
npm run dev -w web
```

## Cómo se conecta a la Fase 4 (pendiente)

`lib/demo-data.ts` tiene la misma forma que devuelve la Edge Function `consulta`
(`{ tipo, respuesta, fuentes[] }`, ver `consulta/index.ts`). Para activar la
funcionalidad real: reemplazar el import estático por un `fetch` a la función,
usando solo la `SUPABASE_ANON_KEY` en el cliente (nunca la service key). La UI no
cambia: ya está modelada contra ese contrato.

## Principio rector del diseño

La UI comunica en 3 segundos que **esto sabe del problema del usuario** — por eso
el inicio es guiado por categorías (no una caja de chat vacía) y la respuesta es
una ficha estructurada con sello de fuente oficial, no un párrafo suelto.
