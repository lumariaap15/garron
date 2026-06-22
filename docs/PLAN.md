# Plan de implementación por fases

Cada fase entrega algo funcional y verificable. El orden está pensado para validar
el riesgo más temprano: primero que el corpus y la búsqueda funcionen, después la
respuesta, y al final la cara visible.

---

## Fase 0 — Cimientos (esqueleto actual)

**Objetivo:** repo navegable, decisiones documentadas, base de datos definida.

- [x] Estructura del monorepo
- [x] README con posicionamiento y arquitectura
- [x] Este plan
- [x] Esquema SQL (`db/schema.sql`): tablas `chunks` y `derivaciones`, índices, función `buscar_hibrido`
- [x] Inventario del corpus (`ingesta/corpus/fuentes.json`)
- [x] Decisiones de arquitectura (`docs/ARQUITECTURA.md`)
- [x] Plantillas de configuración (`.env.example`)

**Entregable:** alguien clona el repo y entiende qué es, cómo está pensado y qué falta.

---

## Fase 1 — Base de datos y esquema

**Objetivo:** Supabase configurado y listo para recibir datos.

Runbook detallado para la parte externa: [`docs/SETUP_FASE1.md`](SETUP_FASE1.md).

- [x] Esquema SQL listo (`db/schema.sql`) — extensión `vector`, tablas, índices, `buscar_hibrido`
- [x] Seed de derivaciones listo (`db/seed_derivaciones.sql`)
- [ ] Crear proyecto en Supabase (free tier) — *manual, ver runbook*
- [ ] Correr `db/schema.sql` en el SQL Editor — *manual*
- [ ] Cargar las derivaciones iniciales (`db/seed_derivaciones.sql`) — *manual*
- [ ] Verificar con las consultas del runbook (extensión, tablas, `vector(384)`, `buscar_hibrido`) — *manual*

**Riesgo que valida:** que el esquema (dimensión 384, diccionario `spanish`, RRF) sea correcto antes de meter datos.

---

## Fase 2 — Ingesta del corpus

**Objetivo:** el corpus oficial cargado en Supabase con embeddings y metadata.

Runbook: [`docs/INGESTA_FASE2.md`](INGESTA_FASE2.md).

- [x] Script de fetch de las URLs del inventario (`ingesta/fetch.js`) — headers, `<main>`, normalización
- [x] Parseo HTML → chunks (selectores `h5`/`h3` **verificados contra el HTML real**; test en `fetch.test.js`)
- [x] Mecanismo de curación de metadata (`ingesta/curar.js`: scaffold + join, falla si falta curar)
- [ ] Completar la curación a mano en `ingesta/corpus/curacion.json` (tema + artículos) — *manual*
- [x] Generación de embeddings con Transformers.js (`ingesta/embeddings.js`) — aviso si excede 128 tokens
- [x] Carga a Supabase (`ingesta/cargar.js`) — **no destructiva** (load-then-swap) + valida 384d
- [x] **Fallo ruidoso:** aborta si una fuente trae 0 chunks o si falta curar metadata, sin borrar el corpus bueno
- [ ] Correr la ingesta real contra Supabase (requiere Fase 1 lista) — *manual*

**Riesgo que valida:** que el corpus alcance y que el chunking preserve la unidad pregunta-respuesta-artículo.
*Estado:* parser validado contra HTML real (27 chunks bien formados de la página madre); falta correr las 6 fuentes restantes.

**Verificación manual:** correr unas búsquedas SQL a mano y ver que devuelven los chunks esperados.

---

## Fase 3 — Búsqueda híbrida

**Objetivo:** dado un texto, recuperar los fragmentos relevantes bien rankeados.

- [ ] Probar `buscar_hibrido` con consultas reales ("me cobran de más", "producto fallado")
- [ ] Calibrar pesos keyword vs. semántico
- [ ] Definir el umbral de evidencia (debajo de X → "sin fundamento suficiente")
- [ ] Set de consultas de prueba (`docs/golden_set.md`) basado en los 4 tipos de consulta

**Riesgo que valida:** que la recuperación en español funcione. Si flojea, cambiar de modelo de embeddings (solo re-generar, el esquema no cambia).

---

## Fase 4 — Edge Function de consulta

**Objetivo:** el endpoint que orquesta todo el flujo.

- [ ] Detección de derivación (paso 1, antes del LLM)
- [ ] Embedding de la consulta (mismo modelo que ingesta)
- [ ] Llamada a `buscar_hibrido` vía RPC
- [ ] Chequeo del umbral de evidencia
- [ ] Prompt de grounding estricto + llamada a Groq
- [ ] Respuesta estructurada: `{ respuesta, articulos[], fuente_url, fecha, deriva }`
- [ ] Manejo de rate limits de Groq (respetar `retry-after`, system prompt cacheable)

**Riesgo que valida:** que el LLM no alucine y respete las citas. Probar contra el golden set.

---

## Fase 5 — Frontend

**Objetivo:** la cara del producto, diseñada para que NO parezca un chat genérico.

- [ ] Inicio guiado por categorías de problema (no una caja de chat vacía)
- [ ] Respuesta en formato ficha: "Qué te corresponde" · "Fundamento legal" · "Cómo reclamar"
- [ ] Badge de fuente oficial visible
- [ ] Tarjeta de derivación clara cuando el caso queda fuera de alcance
- [ ] (Opcional) toggle de "lenguaje accesible" para consumidores hipervulnerables
- [ ] Deploy en Vercel

**Riesgo que valida:** la primera impresión. Que el usuario entienda en 3 segundos que esto sabe de SU problema.

---

## Fase 6 — Pulido y portafolio

**Objetivo:** que sirva como pieza de portafolio sólida.

- [ ] Evaluación contra el golden set (precisión de recuperación, calidad de citas)
- [ ] GitHub Action para re-ingesta (cuando cambie el corpus)
- [ ] Documentar decisiones de ingeniería en el README (por qué híbrido, por qué umbral, etc.)
- [ ] Demo grabada / capturas
- [ ] (Opcional) métricas de uso anónimas

---

## Fuera de alcance (decidido a propósito)

Para mantener el MVP acotado y mantenible:

- **Jurisdicciones provinciales/municipales** — solo Ley 24.240 nacional + Código Civil y Comercial (artículos citados).
- **El trámite de reclamo en sí** — se deriva a la Ventanilla Única; Garrón explica, no ejecuta.
- **Casos excluidos del régimen** — vuelos, profesionales matriculados: se derivan, no se resuelven.
- **Asesoramiento sobre el caso particular** — se deriva a OMIC / abogado.
