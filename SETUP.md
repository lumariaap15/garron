# Setup — poner Garrón a andar

Pasos para levantar el proyecto desde cero. Sigue el orden de las fases del
[plan](docs/PLAN.md).

## Requisitos

- Node.js 18+
- Una cuenta de Supabase (free tier)
- Una API key de Groq (free tier, sin tarjeta): https://console.groq.com/keys

## 1. Configurar entorno

```bash
cp .env.example .env
# editá .env con tus valores de Supabase y Groq
```

## 2. Base de datos (Fase 1)

En el SQL Editor de Supabase, correr en orden:

```sql
-- 1) esquema (tablas, índices, función de búsqueda híbrida)
\i db/schema.sql

-- 2) derivaciones iniciales
\i db/seed_derivaciones.sql
```

(O copiar y pegar el contenido de cada archivo en el editor.)

## 3. Ingesta del corpus (Fase 2)

```bash
npm install
npm run ingesta
```

Esto descarga las fuentes oficiales, las parsea a chunks, genera embeddings
localmente y los carga a Supabase. La primera vez descarga el modelo de embeddings
(queda cacheado).

> ⚠️ Si una fuente cambió su HTML y devuelve 0 chunks, el script aborta a propósito
> para no cargar un corpus vacío. Habría que ajustar los selectores en `ingesta/fetch.js`.

## 4. Edge Function de consulta (Fase 4)

```bash
# requiere la CLI de Supabase
supabase functions deploy consulta
# configurar los secrets de la función
supabase secrets set GROQ_API_KEY=... SUPABASE_SERVICE_KEY=...
```

Probar:

```bash
curl -X POST https://TU-PROYECTO.supabase.co/functions/v1/consulta \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"consulta": "compré una heladera y vino fallada, ¿qué hago?"}'
```

## 5. Frontend (Fase 5)

Ver [web/README.md](web/README.md). Aún no implementado.
