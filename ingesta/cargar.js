// ingesta/cargar.js
// Orquesta la ingesta completa: fetch → chunks → embeddings → Supabase.
//
// Uso:  node ingesta/cargar.js
// Requiere variables de entorno (ver .env.example):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';
import { obtenerChunks } from './fetch.js';
import { curar } from './curar.js';
import { embed, dividirEnHijos, DIMENSIONES } from './embeddings.js';

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

  // 2. Partir cada padre en hijos y embeber los HIJOS (passage:), validando
  //    todo EN MEMORIA antes de tocar la DB. Si algo falla, el corpus viejo
  //    queda intacto. El padre no se embebe: solo se recupera para citar.
  console.log('[cargar] Partiendo en hijos y generando embeddings...');
  let totalHijos = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.tema) {
      throw new Error(
        `[cargar] chunk sin 'tema' (la columna es NOT NULL). ` +
        `Falta el paso de curación de metadata. Fuente: ${chunk.fuente_url}`
      );
    }
    const hijos = dividirEnHijos(chunk.content);
    chunk._hijos = [];
    for (const texto of hijos) {
      const embedding = await embed(texto, 'passage');
      if (embedding.length !== DIMENSIONES) {
        throw new Error(
          `[cargar] embedding de ${embedding.length}d, se esperaban ${DIMENSIONES}d. ` +
          `¿El modelo no coincide con el esquema?`
        );
      }
      chunk._hijos.push({ content: texto, embedding });
      totalHijos++;
    }
    if ((i + 1) % 20 === 0) console.log(`[cargar] padres ${i + 1}/${chunks.length} (${totalHijos} hijos)`);
  }

  // 3. Carga NO destructiva (load-then-swap):
  //    insertamos padres nuevos + sus hijos; recién al final borramos lo viejo.
  //    Si algo falla antes del borrado, el corpus viejo sobrevive.
  // Proyectar el padre a las columnas reales ('clave'/'seccion' son internos).
  const aFila = ({ content, tema, articulos, fuente_url, fuente_titulo, fuente_fecha }) =>
    ({ content, tema, articulos, fuente_url, fuente_titulo, fuente_fecha });

  console.log(`[cargar] Insertando ${chunks.length} padres...`);
  const nuevosIds = [];
  const hijosFilas = [];
  for (let i = 0; i < chunks.length; i += 50) {
    const lote = chunks.slice(i, i + 50);
    const { data, error } = await supabase.from('chunks').insert(lote.map(aFila)).select('id');
    if (error) throw error;
    // El insert devuelve los ids en el mismo orden que se enviaron → zip con sus hijos.
    lote.forEach((chunk, j) => {
      const chunk_id = data[j].id;
      nuevosIds.push(chunk_id);
      for (const h of chunk._hijos) hijosFilas.push({ chunk_id, content: h.content, embedding: h.embedding });
    });
    console.log(`[cargar]   padres ${Math.min(i + 50, chunks.length)}/${chunks.length}`);
  }

  console.log(`[cargar] Insertando ${hijosFilas.length} hijos...`);
  for (let i = 0; i < hijosFilas.length; i += 50) {
    const { error } = await supabase.from('chunk_hijos').insert(hijosFilas.slice(i, i + 50));
    if (error) throw error;
    console.log(`[cargar]   hijos ${Math.min(i + 50, hijosFilas.length)}/${hijosFilas.length}`);
  }

  // 4. Borrar el corpus anterior (padres que no son de esta carga). El borrado
  //    de un padre arrastra a sus hijos por la FK on delete cascade.
  console.log('[cargar] Eliminando el corpus anterior...');
  const { error: delErr } = await supabase
    .from('chunks')
    .delete()
    .not('id', 'in', `(${nuevosIds.join(',')})`);
  if (delErr) {
    throw new Error(
      `[cargar] Los chunks nuevos se cargaron OK, pero falló el borrado de los viejos: ` +
      `${delErr.message}. Hay duplicados temporales; re-correr resuelve.`
    );
  }

  console.log(`[cargar] Listo. ${nuevosIds.length} padres + ${hijosFilas.length} hijos cargados, corpus anterior eliminado.`);
}

main().catch((e) => {
  console.error('[cargar] ERROR:', e.message);
  process.exit(1);
});
