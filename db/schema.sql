-- ============================================================
-- Garrón — Esquema de base de datos (Supabase / PostgreSQL)
-- ============================================================
-- Correr en el SQL Editor de Supabase.
-- Embeddings: paraphrase-multilingual-MiniLM-L12-v2 → 384 dimensiones.
-- Full-text search en español (acentos, plurales).
-- ============================================================

-- Extensión de vectores
create extension if not exists vector;

-- ------------------------------------------------------------
-- Tabla principal: fragmentos del corpus oficial
-- ------------------------------------------------------------
create table if not exists chunks (
  id            bigserial primary key,
  content       text not null,            -- texto del fragmento (par pregunta-respuesta o artículo)
  tema          text not null,            -- 'garantia' | 'servicios' | 'arrepentimiento' | 'servicios_publicos' | ...
  articulos     text[] default '{}',      -- ['Ley 24.240 Art. 11', 'CCyC Art. 1110']
  fuente_url    text not null,            -- URL oficial para citar
  fuente_titulo text,                     -- nombre legible de la fuente
  fuente_fecha  date,                     -- fecha de actualización de la fuente
  embedding     vector(384),              -- vector del modelo multilingüe
  -- columna de full-text autogenerada, diccionario español
  fts           tsvector generated always as (to_tsvector('spanish', content)) stored,
  created_at    timestamptz default now()
);

-- Índice semántico (HNSW, producto interno — el modelo produce vectores normalizados)
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_ip_ops);

-- Índice de full-text
create index if not exists chunks_fts_idx
  on chunks using gin (fts);

-- ------------------------------------------------------------
-- Tabla de derivaciones: casos fuera de alcance
-- ------------------------------------------------------------
create table if not exists derivaciones (
  id        bigserial primary key,
  patron    text not null,   -- término o frase que dispara la derivación
  mensaje   text not null,   -- qué se le dice al usuario
  organismo text,            -- a dónde se lo deriva
  url       text             -- link oficial del organismo
);

-- ------------------------------------------------------------
-- Función de búsqueda híbrida con Reciprocal Rank Fusion
-- ------------------------------------------------------------
-- Combina full-text search (keyword) y similitud vectorial (semántica).
-- RRF fusiona ambos rankings sin necesidad de normalizar scores dispares.
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
  score         float
)
language sql
as $$
with fts_rank as (
  select
    c.id,
    row_number() over (
      order by ts_rank_cd(c.fts, websearch_to_tsquery('spanish', query_text)) desc
    ) as rank
  from chunks c
  where c.fts @@ websearch_to_tsquery('spanish', query_text)
),
sem_rank as (
  select
    c.id,
    row_number() over (
      order by c.embedding <#> query_embedding
    ) as rank
  from chunks c
)
select
  c.id,
  c.content,
  c.tema,
  c.articulos,
  c.fuente_url,
  c.fuente_titulo,
  c.fuente_fecha,
  coalesce(peso_fts        / (rrf_k + f.rank), 0.0) +
  coalesce(peso_semantico  / (rrf_k + s.rank), 0.0) as score
from chunks c
left join fts_rank f on c.id = f.id
left join sem_rank s on c.id = s.id
where f.id is not null or s.id is not null
order by score desc
limit match_count;
$$;

-- Nota: PostgREST no expone los operadores de pgvector directamente,
-- por eso la búsqueda se llama vía rpc('buscar_hibrido', {...}) desde supabase-js.
