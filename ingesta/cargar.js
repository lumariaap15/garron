// ingesta/cargar.js
// Orquesta la ingesta completa: fetch → chunks → embeddings → Supabase.
//
// Uso:  node ingesta/cargar.js
// Requiere variables de entorno (ver .env.example):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';
import { obtenerChunks } from './fetch.js';
import { curar } from './curar.js';
import { embed, DIMENSIONES } from './embeddings.js';

// Carga el .env del proyecto si Node lo soporta (>=20.12 / 22 / 24) y el archivo
// existe. No agrega dependencia: usa la API nativa. En Node 18 es no-op → hay
// que exportar las variables a mano o correr con `node --env-file=.env`.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch { /* sin .env: seguimos con process.env */ }
}

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY. Ver .env.example');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Obtener chunks (aborta si alguna fuente trae 0)
  const chunks = await obtenerChunks();
  if (chunks.length === 0) {
    throw new Error('[cargar] 0 chunks. Abortando sin tocar la tabla.');
  }

  // 1b. Curar metadata (tema + artículos). Aborta si falta curar algún chunk.
  console.log('[cargar] Aplicando curación de metadata...');
  await curar(chunks);

  // 2. Generar embeddings + validar dimensión y metadata antes de tocar la DB.
  //    Si algo está mal, fallamos acá, con el corpus viejo intacto.
  console.log('[cargar] Generando embeddings...');
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.tema) {
      throw new Error(
        `[cargar] chunk sin 'tema' (la columna es NOT NULL). ` +
        `Falta el paso de curación de metadata. Fuente: ${chunk.fuente_url}`
      );
    }
    chunk.embedding = await embed(chunk.content);
    if (chunk.embedding.length !== DIMENSIONES) {
      throw new Error(
        `[cargar] embedding de ${chunk.embedding.length}d, se esperaban ${DIMENSIONES}d. ` +
        `¿El modelo no coincide con el esquema?`
      );
    }
    if ((i + 1) % 10 === 0) console.log(`[cargar] embeddings ${i + 1}/${chunks.length}`);
  }

  // 3. Carga NO destructiva (load-then-swap):
  //    insertamos primero los nuevos; solo si TODO entra, borramos los viejos.
  //    Si un lote falla, lanzamos antes de borrar nada → el corpus viejo sobrevive.
  console.log(`[cargar] Insertando ${chunks.length} chunks nuevos...`);
  // Proyectar a las columnas reales de la tabla: los chunks llevan campos
  // internos del pipeline ('clave', 'seccion') que NO son columnas de 'chunks'.
  const aFila = ({ content, tema, articulos, fuente_url, fuente_titulo, fuente_fecha, embedding }) =>
    ({ content, tema, articulos, fuente_url, fuente_titulo, fuente_fecha, embedding });
  const nuevosIds = [];
  for (let i = 0; i < chunks.length; i += 50) {
    const lote = chunks.slice(i, i + 50).map(aFila);
    const { data, error } = await supabase.from('chunks').insert(lote).select('id');
    if (error) throw error;
    nuevosIds.push(...data.map((r) => r.id));
    console.log(`[cargar]   ${Math.min(i + 50, chunks.length)}/${chunks.length}`);
  }

  // 4. Borrar el corpus anterior (todo lo que no sea de esta carga).
  console.log('[cargar] Eliminando el corpus anterior...');
  const { error: delErr } = await supabase
    .from('chunks')
    .delete()
    .not('id', 'in', `(${nuevosIds.join(',')})`);
  if (delErr) {
    // Los nuevos ya están cargados; quedan duplicados con los viejos.
    // Es un estado recuperable (re-correr borra los viejos), no una pérdida.
    throw new Error(
      `[cargar] Los chunks nuevos se cargaron OK, pero falló el borrado de los viejos: ` +
      `${delErr.message}. Hay duplicados temporales; re-correr resuelve.`
    );
  }

  console.log(`[cargar] Listo. ${nuevosIds.length} chunks cargados, corpus anterior eliminado.`);
}

main().catch((e) => {
  console.error('[cargar] ERROR:', e.message);
  process.exit(1);
});
