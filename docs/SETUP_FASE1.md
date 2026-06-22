# Fase 1 — Setup de Supabase (runbook)

Servicio externo. Estos pasos se hacen una sola vez, a mano, en el panel de Supabase.
Tiempo estimado: ~5 minutos. Los archivos SQL ya están en el repo (`db/`).

---

## 1. Crear el proyecto

1. Entrar a https://supabase.com → **New project** (free tier).
2. Elegir nombre (`garron`), una contraseña de base de datos (guardala) y la región más cercana.
3. Esperar a que termine de aprovisionar (~2 min).

## 2. Habilitar la extensión `vector`

No hace falta hacerlo a mano: `db/schema.sql` ya incluye `create extension if not exists vector;`.
Igual podés verificarlo en **Database → Extensions** y buscar `vector` (pgvector).

## 3. Correr el esquema

1. Ir a **SQL Editor → New query**.
2. Pegar el contenido completo de `db/schema.sql`.
3. **Run.** Debe terminar sin errores (crea `chunks`, `derivaciones`, los índices y la función `buscar_hibrido`).

## 4. Cargar las derivaciones iniciales

1. Nueva query en el **SQL Editor**.
2. Pegar el contenido de `db/seed_derivaciones.sql`.
3. **Run.** Inserta 5 filas en `derivaciones`.

## 5. Verificar (la parte que cierra el riesgo de la fase)

Corré estas consultas en el SQL Editor. Resultado esperado entre paréntesis:

```sql
-- La extensión está activa (1 fila)
select extname from pg_extension where extname = 'vector';

-- Las tablas existen (2 filas: chunks, derivaciones)
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('chunks','derivaciones');

-- La columna embedding tiene 384 dimensiones
select a.attname, format_type(a.atttypid, a.atttypmod) as tipo
from pg_attribute a
where a.attrelid = 'chunks'::regclass and a.attname = 'embedding';
-- esperado: vector(384)

-- La función buscar_hibrido existe y compila
select proname, pg_get_function_arguments(oid) as args
from pg_proc where proname = 'buscar_hibrido';
-- esperado: 1 fila con los 6 parámetros

-- Las derivaciones se cargaron (5 filas)
select count(*) from derivaciones;

-- RLS está activo en ambas tablas (2 filas, ambas con rowsecurity = true)
select relname, relrowsecurity as rls_activo
from pg_class
where relname in ('chunks','derivaciones');
-- esperado: chunks=true, derivaciones=true

-- No hay policies para anon (0 filas → lockdown total, solo service_role accede)
select policyname, tablename from pg_policies
where tablename in ('chunks','derivaciones');
-- esperado: 0 filas
```

Si las consultas dan lo esperado, la Fase 1 está completa.

## 6. Guardar las credenciales para las fases siguientes

En **Project Settings → API**, copiar a tu `.env` local (ver `.env.example`):

```
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
```

> ⚠️ La `service_role` key salta RLS y es secreta. Solo va en `.env` (gitignored) y en
> los secrets de GitHub Actions / Edge Functions — **nunca** en el cliente ni en el repo.

---

## Notas de diseño (por qué el esquema es así)

- **`vector(384)`**: dimensión del modelo `paraphrase-multilingual-MiniLM-L12-v2`. Si en la
  Fase 3 se cambia de modelo, cambiar este número y re-ingestar (el resto del esquema no cambia).
- **Índice HNSW con `vector_ip_ops`** (producto interno): correcto porque el modelo entrega
  vectores normalizados, así el producto interno equivale al coseno.
- **`to_tsvector('spanish', ...)`**: full-text en español (maneja acentos y plurales).
- **`buscar_hibrido`** se llama vía `rpc('buscar_hibrido', {...})` desde supabase-js, no por REST.
