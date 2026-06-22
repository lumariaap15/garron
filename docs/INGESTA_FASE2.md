# Fase 2 — Ingesta del corpus (runbook)

Carga el corpus oficial en Supabase con embeddings y metadata curada.
Requiere la **Fase 1 lista** (ver `SETUP_FASE1.md`) y las variables `SUPABASE_URL` /
`SUPABASE_SERVICE_KEY` en tu `.env`.

## Flujo

```
fetch.js   → descarga + parsea HTML a chunks (pregunta-respuesta / artículo)
curar.js   → asigna tema + artículos desde corpus/curacion.json (curado a mano)
embeddings → vector 384d local con Transformers.js
cargar.js  → inserta en Supabase de forma NO destructiva (load-then-swap)
```

## Pasos

### 0. Instalar dependencias (una vez)
```bash
npm install
```

### 1. Verificar el parser contra el HTML real
```bash
node --test ingesta/*.test.js
```
> Usá el glob (`*.test.js`), no `node --test ingesta/`. Desde Node 21 un
> directorio pelado ya no se auto-descubre y Node intenta ejecutarlo como script
> (`Cannot find module .../ingesta`). El glob lo expande el shell a archivos
> concretos y funciona en Node 18, 22 y 24.
Los tests corren contra un fixture guardado (`ingesta/corpus/fixtures/`). Si
argentina.gob.ar cambió su HTML, fallan acá — antes de tocar producción.

### 2. Generar el esqueleto de curación
```bash
node ingesta/curar.js --scaffold
```
Descarga las fuentes y crea/actualiza `ingesta/corpus/curacion.json` con una
entrada por chunk: `tema` **sugerido** (a partir del `h3` de la sección) y
`articulos: []`. Solo agrega claves nuevas; **no pisa** lo que ya editaste.

### 3. Curar a mano (el paso de criterio)
Abrí `ingesta/corpus/curacion.json` y, por cada pregunta:
- Revisá/corregí el `tema` sugerido (debe ser un slug consistente:
  `garantia`, `servicios`, `servicios_publicos`, `arrepentimiento`, `contratos`,
  `proteccion`, `reclamos`, `general`...).
- Completá `articulos` con las citas, ej. `["Ley 24.240 Art. 11", "CCyC Art. 1110"]`.

> La Ley 24.240 (capa 2) **no** va en este archivo: se cura sola, un chunk por artículo.

### 4. Cargar a Supabase
```bash
node ingesta/cargar.js
```
- Si falta curar algún chunk → aborta y lista las claves faltantes (no carga nada).
- Inserta los chunks nuevos y **recién después** borra el corpus anterior. Si algo
  falla a mitad, el corpus viejo queda intacto.

### 5. Verificación manual (SQL Editor de Supabase)
```sql
-- ¿Cuántos chunks y de qué temas?
select tema, count(*) from chunks group by tema order by 2 desc;

-- Mirar un par de chunks reales
select tema, articulos, left(content, 120) from chunks limit 5;

-- Probar que el FTS en español matchea (anticipo de la Fase 3)
select left(content,80) from chunks
where fts @@ websearch_to_tsquery('spanish', 'garantía producto fallado') limit 5;
```

## Notas de diseño

- **Un parser por plantilla (campo `parser` en `fuentes.json`):** las páginas
  oficiales no comparten una sola estructura. `fetch.js` enruta por fuente:
  - `guia` (default) — guías Ley Simple con preguntas `<h5>` dentro de `<main>`;
    la sección es el `<h3>` anterior; la respuesta son los hermanos hasta el
    próximo `h5`/`h3`. Un chunk por par pregunta-respuesta.
  - `seccion` — páginas tipo *consumo-economia* / *ventanilla-unica*: secciones
    `<h3>` + prosa, **sin** preguntas `h5`. Un chunk por sección (ignora ruido:
    "En esta página", "Volver al índice", "Texto completo de la norma").
  - `ley` — texto legal (capa 2): un chunk por artículo. El encabezado real
    (`ARTÍCULO N —`) se distingue de las referencias en el texto (`artículo N
    de…`) para no contar artículos fantasma; la cita base viene de `fuente.cita`.
  - `anexo` — resoluciones cuyo contenido vive en un anexo enumerado (`a) b)
    c)…`, ej. Res. 53/2003): un chunk por cláusula letrada.
- **Verificá el HTML antes de tocar producción:** cada plantilla tiene un fixture
  en `corpus/fixtures/` y tests en `fetch.test.js`. Si el sitio cambia la
  estructura, fallan ahí. Si una fuente devuelve 0 chunks, `fetch.js` **aborta**.
- **Truncación a 128 tokens:** los pares pregunta-respuesta entran completos; los
  artículos largos de la ley se embeben solo en su inicio (`embeddings.js` avisa).
  Para citar se guarda el texto completo igual.
- **Curación manual:** decisión deliberada (corpus chico → precisión de citas > automatización).
- **Carga no destructiva:** una re-ingesta fallida nunca deja el corpus vacío.
