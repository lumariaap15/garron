# Garrón

**La guía clara cuando compraste, salió mal y toca reclamar.**

Garrón es un asistente de derechos del consumidor para Argentina. Cuando tenés un
problema con una compra o un servicio, te dice **qué te corresponde según la ley,
citando el artículo exacto**, y **qué hacer para reclamarlo** — con el link directo
al organismo oficial.

No es un chat genérico que opina. Cada respuesta está fundada en la Ley 24.240 de
Defensa del Consumidor y en las guías oficiales del Estado, con la fuente a la vista
y verificable.

---

## ¿Por qué no es "preguntarle a ChatGPT"?

Un modelo de lenguaje general puede explicarte la idea de la ley, pero:

- **Inventa o generaliza los artículos.** Garrón cita el artículo exacto (ej. *Ley 24.240, Art. 11*) con link al texto oficial. La cita es verificable, no decorativa.
- **Responde con la misma seguridad sepa o no.** Garrón solo afirma lo que respalda
  el corpus oficial. Si no hay fundamento, lo dice y deriva, en vez de alucinar.
- **No te lleva a la acción.** Garrón termina en el paso concreto: el artículo que
  te ampara + cómo reclamar + el link a la Ventanilla Única Federal.
- **No conoce qué queda fuera.** Hay reclamos que NO van por Defensa del Consumidor
  (vuelos, profesionales matriculados). Garrón los reconoce y deriva al organismo correcto.

En un dominio legal, la diferencia entre "suena bien" y "está fundado y citado" es
todo. Eso es lo que Garrón hace y un asistente genérico no.

---

## Cómo funciona (RAG con verificación de evidencia)

```
Consulta del usuario
   │
   ▼
1. ¿Es un caso fuera de alcance?  ── sí ──► Derivar al organismo correcto (sin LLM)
   │ no
   ▼
2. Embedding de la consulta (modelo local, español)
   │
   ▼
3. Búsqueda híbrida (keyword + semántica, fusionadas con RRF)
   │
   ▼
4. ¿Hay evidencia suficiente?  ── no ──► "No tengo info oficial sobre esto" + derivar
   │ sí
   ▼
5. El LLM redacta SOLO con los fragmentos recuperados, citando artículo y fuente
   │
   ▼
Respuesta: qué te corresponde · fundamento legal (con link) · cómo reclamar
```

Las cuatro piezas que lo distinguen de un RAG ingenuo (`embed → vector search → LLM`):

1. **Derivación determinística** antes del LLM (gratis, correcta, ahorra cuota).
2. **Búsqueda híbrida con RRF** — keyword para términos exactos ("garantía"),
   semántica para lenguaje natural ("me vendieron algo roto").
3. **Umbral de evidencia** — sin fundamento suficiente, no inventa.
4. **Citación estricta** — cada afirmación apunta a su artículo y URL oficial.

---

## Stack

Todo JavaScript/TypeScript, todo gratuito o free tier.

| Pieza | Tecnología | Costo |
|---|---|---|
| Ingesta | Node.js + `@xenova/transformers` + `supabase-js` | Gratis (local / GitHub Actions) |
| Base de datos | Supabase Postgres + `pgvector` + full-text search | Free tier |
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (384d), local | Gratis |
| Búsqueda | Función SQL `buscar_hibrido` (RRF) | Incluido |
| Backend de consulta | Supabase Edge Function (Deno/TS) | Free tier |
| LLM | Groq free tier (Llama) vía `fetch` | Gratis a bajo volumen |
| Frontend | Next.js en Vercel | Free tier |

---

## Estructura del repo

```
garron/
├── db/            Esquema SQL: tablas, índices, función de búsqueda híbrida
├── ingesta/       Scripts de scraping, chunking y generación de embeddings
│   └── corpus/    Inventario de fuentes oficiales (qué se ingiere)
├── consulta/      Edge Function: clasificar → buscar → responder/derivar
├── web/           Frontend Next.js (UI guiada por categorías de problema)
├── scripts/       Utilidades (setup, verificación)
└── docs/          Plan por fases, decisiones de arquitectura, fuentes
```

---

## Estado del proyecto

🚧 **Esqueleto inicial.** Ver el [plan de implementación por fases](docs/PLAN.md)
para el detalle de qué está hecho y qué sigue.

---

## Aviso legal

Garrón tiene carácter **orientativo e informativo**. Se basa en fuentes oficiales
(Ley 24.240 y guías del Ministerio de Justicia) pero **no reemplaza el
asesoramiento de un profesional** ni la versión original de la norma. Para tu caso
concreto, consultá la Oficina Municipal de Información al Consumidor (OMIC) o un
abogado.

## Licencia

MIT — ver [LICENSE](LICENSE).
