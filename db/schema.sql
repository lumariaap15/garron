-- ============================================================
-- Garrón — Esquema de base de datos (Supabase / PostgreSQL)
-- ============================================================
-- Correr en el SQL Editor de Supabase.
-- Arquitectura PARENT-CHILD:
--   chunks       = unidad CITABLE (artículo / par pregunta-respuesta completo)
--   chunk_hijos  = fragmentos chicos que se EMBEBEN (≤ ~80 palabras, entran
--                  enteros en la ventana de 128 tokens del modelo → sin truncar)
-- Se busca por hijo (semántica) + por padre (full-text), se recupera el PADRE.
-- Embeddings: 384 dimensiones (MiniLM o multilingual-e5-small, ambos 384d).
-- Full-text search en español (acentos, plurales).
-- ============================================================

-- Extensión de vectores
create extension if not exists vector;

-- ------------------------------------------------------------
-- MIGRACIÓN parent-child (re-ejecutable):
-- El corpus se regenera entero con `node ingesta/cargar.js`, así que estas dos
-- tablas se pueden recrear sin pérdida. 'derivaciones' NO se toca (tiene seed).
-- ------------------------------------------------------------
drop table if exists chunk_hijos cascade;
drop table if exists chunks      cascade;

-- ------------------------------------------------------------
-- Tabla PADRE: la unidad citable del corpus oficial
-- ------------------------------------------------------------
create table chunks (
  id            bigserial primary key,
  content       text not null,            -- texto COMPLETO (par P-R o artículo/cláusula entero)
  tema          text not null,            -- 'garantia' | 'servicios' | 'contratos' | 'norma_completa' | ...
  articulos     text[] default '{}',      -- ['Ley 24.240 Art. 11', 'CCyC Art. 1110']
  fuente_url    text not null,            -- URL oficial para citar
  fuente_titulo text,                     -- nombre legible de la fuente
  fuente_fecha  date,                     -- fecha de actualización de la fuente
  -- full-text autogenerado sobre el contenido COMPLETO (nunca se trunca):
  -- es la mitad keyword de la búsqueda y la señal de dominio para la compuerta.
  fts           tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------
-- Tabla HIJO: fragmentos chicos que se embeben sin truncación
-- ------------------------------------------------------------
create table chunk_hijos (
  id         bigserial primary key,
  chunk_id   bigint not null references chunks (id) on delete cascade,
  content    text not null,               -- fragmento ≤ ~80 palabras
  embedding  vector(384),                 -- vector del modelo multilingüe (sin truncar)
  created_at timestamptz default now()
);

-- Índice semántico sobre los HIJOS (HNSW, producto interno → vectores normalizados)
create index chunk_hijos_embedding_idx
  on chunk_hijos using hnsw (embedding vector_ip_ops);

-- FK para subir hijo → padre rápido
create index chunk_hijos_chunk_id_idx on chunk_hijos (chunk_id);

-- Índice de full-text sobre el PADRE
create index chunks_fts_idx on chunks using gin (fts);

-- ------------------------------------------------------------
-- Tabla de derivaciones: casos fuera de alcance (NO se recrea)
-- ------------------------------------------------------------
create table if not exists derivaciones (
  id        bigserial primary key,
  patron    text not null,   -- término o frase que dispara la derivación
  mensaje   text not null,   -- qué se le dice al usuario
  organismo text,            -- a dónde se lo deriva
  url       text             -- link oficial del organismo
);

-- ------------------------------------------------------------
-- Row Level Security (lockdown total)
-- ------------------------------------------------------------
-- Las tablas se exponen por PostgREST. Sin RLS, la 'anon' key (que viaja al
-- cliente) podría leerlas/escribirlas. Activamos RLS SIN policies: 'anon' queda
-- denegado para todo. La Edge Function usa la 'service_role' key, que SALTA RLS.
-- ------------------------------------------------------------
alter table chunks       enable row level security;
alter table chunk_hijos  enable row level security;
alter table derivaciones enable row level security;

-- ------------------------------------------------------------
-- Función de búsqueda híbrida parent-child con Reciprocal Rank Fusion
-- ------------------------------------------------------------
-- Fusiona dos rankings A NIVEL PADRE:
--   - keyword: ts_rank sobre chunks.fts (contenido completo del padre)
--   - semántica: mejor hijo por padre (menor distancia) → ranking de padres
-- RRF combina ambos rankings sin normalizar scores dispares.
-- Devuelve además `fts_match`: si el padre matcheó el full-text. Es la señal de
-- DOMINIO para la compuerta de evidencia (una consulta fuera de tema no comparte
-- vocabulario → no matchea FTS), no el score de RRF (que es solo posicional).
-- ------------------------------------------------------------
create or replace function buscar_hibrido (
  query_text       text,
  query_embedding  vector(384),
  match_count      int   default 4,
  peso_fts         float default 1.0,
  peso_semantico   float default 1.0,
  rrf_k            int   default 50
)
returns table (
  id            bigint,
  content       text,
  tema          text,
  articulos     text[],
  fuente_url    text,
  fuente_titulo text,
  fuente_fecha  date,
  score         float,
  fts_score     float,
  fts_match     boolean
)
-- Roles de cada tsquery (sin comentarios DENTRO del cuerpo, para que el paste no
-- se rompa si se pierde un salto de línea tras un '--'):
--   tsq_and (websearch, AND): RANKEA. Preciso; si no matchea, manda la semántica.
--   tsq_or  (lexemas '|'):    COMPUERTA de dominio (fts_score, nivel consulta).
language sql
as $$
with q as (
  select
    websearch_to_tsquery('spanish', query_text) as tsq_and,
    to_tsquery('spanish',
      array_to_string(tsvector_to_array(to_tsvector('spanish', query_text)), ' | ')
    ) as tsq_or
),
fts_rank as (
  select
    c.id,
    row_number() over (order by ts_rank_cd(c.fts, (select tsq_and from q)) desc) as rank
  from chunks c
  where c.fts @@ (select tsq_and from q)
),
gate as (
  select coalesce(max(ts_rank_cd(c.fts, (select tsq_or from q))), 0.0) as fscore
  from chunks c
  where c.fts @@ (select tsq_or from q)
),
sem_padre as (
  select h.chunk_id as id, min(h.embedding <#> query_embedding) as dist
  from chunk_hijos h
  group by h.chunk_id
),
sem_rank as (
  select id, row_number() over (order by dist asc) as rank
  from sem_padre
)
select
  c.id,
  c.content,
  c.tema,
  c.articulos,
  c.fuente_url,
  c.fuente_titulo,
  c.fuente_fecha,
  coalesce(peso_fts       / (rrf_k + f.rank), 0.0) +
  coalesce(peso_semantico / (rrf_k + s.rank), 0.0) as score,
  (select fscore from gate) as fts_score,
  (f.id is not null) as fts_match
from chunks c
left join fts_rank f on c.id = f.id
left join sem_rank s on c.id = s.id
where f.id is not null or s.id is not null
order by score desc
limit match_count;
$$;

-- Nota: PostgREST no expone los operadores de pgvector directamente,
-- por eso la búsqueda se llama vía rpc('buscar_hibrido', {...}) desde supabase-js.
