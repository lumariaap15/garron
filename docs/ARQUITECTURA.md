# Decisiones de arquitectura

Este documento explica el *por qué* de las decisiones técnicas. La idea es que
cualquiera que lea el repo (incluido un evaluador de portafolio) entienda que cada
pieza está donde está por una razón, no por inercia.

## Por qué RAG y no solo un LLM

El dominio (derechos del consumidor argentino) cumple las condiciones donde RAG es
la herramienta correcta y un LLM general falla: la respuesta útil no es "qué dice la
ley en general" sino "qué artículo exacto ampara TU situación y cómo reclamar". Un
LLM general inventa números de artículo (alucinación), generaliza, y no cita fuentes
verificables. RAG sobre un corpus oficial curado resuelve esas tres cosas.

## Por qué búsqueda híbrida (keyword + semántica)

- **Keyword (full-text en español)** clava los términos exactos del dominio:
  "garantía", "arrepentimiento", "factura".
- **Semántica (pgvector)** recupera el fragmento correcto aunque el usuario no use
  el término técnico: "me vendieron algo roto" → artículo de garantía.

Solos, cada uno tiene huecos. Juntos se complementan. Se fusionan con **Reciprocal
Rank Fusion (RRF)**, que combina los dos rankings sin necesidad de normalizar scores
de naturaleza distinta (ts_rank vs. distancia vectorial).

## Por qué derivación determinística ANTES del LLM

Algunos casos no se resuelven por Defensa del Consumidor (vuelos → ANAC,
profesionales matriculados → colegios). Detectarlos con una tabla de patrones, antes
de llamar al LLM, tiene tres ventajas: la respuesta es correcta y consistente, es
gratis (no gasta cuota de Groq), y es la conducta responsable (derivar al organismo
correcto en vez de improvisar).

## Por qué un umbral de evidencia

Si la búsqueda no recupera nada suficientemente relevante, el sistema responde
"no tengo información oficial suficiente" y deriva, en vez de forzar al LLM a
inventar. En un dominio legal, una alucinación puede mandar a alguien a hacer un
reclamo mal fundado. El umbral es la red de seguridad contra eso. Se calibra en la
Fase 3 contra el golden set.

## Por qué embeddings locales (Transformers.js) y no una API

- **Costo cero real:** corren en nuestra compute (ingesta) y en la Edge Function
  (consulta). No consumen ningún free tier que pueda cambiar o agotarse.
- **El embedding nunca es el cuello de botella:** solo el LLM (Groq) consume cuota.
- **Modelo multilingüe** (`paraphrase-multilingual-MiniLM-L12-v2`, 384d) porque el
  corpus es 100% en español. Si la recuperación flojeara, se cambia el modelo y se
  re-generan embeddings — el esquema no cambia mientras se mantengan 384 dimensiones.

## Por qué Groq para el LLM

Free tier sin tarjeta, muy rápido (LPU), suficiente para MVP y demo de bajo volumen.
El límite que más importa es el de tokens por minuto (~6.000 TPM en free tier), por
eso: se mandan pocos chunks (4) como contexto y el system prompt es fijo para
aprovechar el caché de prompt (los tokens cacheados no cuentan al rate limit).
Si el proyecto creciera, agregar tarjeta sube los límites 10x sin cambiar de proveedor.

## Por qué Supabase

Postgres + pgvector + full-text search + Edge Functions, todo en free tier y todo
accesible desde JS. La búsqueda híbrida vive como función SQL y se llama vía RPC
(PostgREST no expone los operadores de pgvector directamente).

## Decisiones de alcance (qué dejamos afuera y por qué)

- **Solo jurisdicción nacional** (Ley 24.240 + CCyC): mantener el corpus acotado y
  estable. Las leyes provinciales y OMIC locales multiplicarían el corpus.
- **No ejecutamos el trámite:** Garrón explica y deriva a la Ventanilla Única; el
  reclamo se hace en la plataforma oficial.
- **No asesoramos sobre el caso particular:** orientación informativa, no legal.
