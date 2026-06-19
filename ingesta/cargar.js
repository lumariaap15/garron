// ingesta/cargar.js
// Orquesta la ingesta completa: fetch → chunks → embeddings → Supabase.
//
// Uso:  node ingesta/cargar.js
// Requiere variables de entorno (ver .env.example):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';
import { obtenerChunks } from './fetch.js';
import { embed } from './embeddings.js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY. Ver .env.example');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // 1. Obtener chunks (aborta si alguna fuente trae 0)
  const chunks = await obtenerChunks();

  // 2. Generar embeddings
  console.log('[cargar] Generando embeddings...');
  for (const chunk of chunks) {
    chunk.embedding = await embed(chunk.content);
  }

  // 3. Reemplazar el corpus de forma segura:
  //    se cargan los nuevos ANTES de borrar los viejos sería lo ideal con
  //    versionado; para el MVP, truncar + insertar dentro de una verificación.
  if (chunks.length === 0) {
    throw new Error('[cargar] 0 chunks. Abortando sin tocar la tabla.');
  }

  console.log('[cargar] Limpiando tabla chunks...');
  const { error: delErr } = await supabase.from('chunks').delete().neq('id', 0);
  if (delErr) throw delErr;

  console.log(`[cargar] Insertando ${chunks.length} chunks...`);
  // Insertar en lotes de 50
  for (let i = 0; i < chunks.length; i += 50) {
    const lote = chunks.slice(i, i + 50);
    const { error } = await supabase.from('chunks').insert(lote);
    if (error) throw error;
    console.log(`[cargar]   ${Math.min(i + 50, chunks.length)}/${chunks.length}`);
  }

  console.log('[cargar] Listo. Corpus cargado.');
}

main().catch((e) => {
  console.error('[cargar] ERROR:', e.message);
  process.exit(1);
});
