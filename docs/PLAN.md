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

- [ ] Crear proyecto en Supabase (free tier)
- [ ] Habilitar extensión `vector`
- [ ] Correr `db/schema.sql` en el SQL Editor
- [ ] Cargar las derivaciones iniciales (`db/seed_derivaciones.sql`)
- [ ] Verificar que la función `buscar_hibrido` existe y compila

**Riesgo que valida:** que el esquema (dimensión 384, diccionario `spanish`, RRF) sea correcto antes de meter datos.

---

## Fase 2 — Ingesta del corpus

**Objetivo:** el corpus oficial cargado en Supabase con embeddings y metadata.

- [ ] Script de fetch de las URLs del inventario (`ingesta/fetch.js`)
- [ ] Parseo HTML → chunks (las guías Ley Simple ya vienen en pares pregunta-respuesta)
- [ ] Curación de metadata: tema, artículos citados, URL, fecha (corpus chico → vale hacerlo bien)
- [ ] Generación de embeddings con Transformers.js (`ingesta/embeddings.js`)
- [ ] Carga a Supabase (`ingesta/cargar.js`)
- [ ] **Fallo ruidoso:** abortar si se trae 0 chunks (HTML cambió) en vez de borrar el corpus bueno

**Riesgo que valida:** que el corpus alcance y que el chunking preserve la unidad pregunta-respuesta-artículo.

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
