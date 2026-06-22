// ingesta/curar.js
// Curación de metadata: asigna `tema` y `articulos` a cada chunk a partir de un
// archivo curado a mano (corpus/curacion.json). Decisión de diseño: corpus chico
// → la precisión de tema/citas vale más que la automatización (ver docs/PLAN.md).
//
// Dos modos:
//   node ingesta/curar.js --scaffold   → genera/actualiza el esqueleto de curación
//                                         (pre-rellena `tema` sugerido, NO pisa lo editado)
//   import { curar } from './curar.js'  → join usado por cargar.js antes de embeddings
//
// El join FALLA RUIDOSAMENTE si una clave no está curada: preferimos abortar a
// cargar un chunk con tema/citas incorrectas.

import { readFile, writeFile } from 'node:fs/promises';
import { obtenerChunks } from './fetch.js';

const CURACION = new URL('./corpus/curacion.json', import.meta.url);

// Sugerencia de tema a partir del título de la sección (h3). Es solo un punto de
// partida para el scaffold; el humano revisa y corrige en curacion.json.
const SECCION_A_TEMA = {
  'la garantia': 'garantia',
  'servicios': 'servicios',
  'servicios publicos': 'servicios_publicos',
  'contratos de adhesion y derecho a la informacion': 'contratos',
  'proteccion de la ley': 'proteccion',
  'mas proteccion': 'proteccion',
  'reclamos': 'reclamos',
  'dudas frecuentes': 'general'
};

function slug(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sacar acentos
    .trim();
}

function temaSugerido(seccion) {
  const s = slug(seccion);
  return SECCION_A_TEMA[s] || s.replace(/\s+/g, '_') || 'general';
}

async function leerCuracion() {
  try {
    return JSON.parse(await readFile(CURACION, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') return { _descripcion: '', items: {} };
    throw e;
  }
}

// --- Join: aplica la curación a los chunks (usado por cargar.js) ---
export async function curar(chunks) {
  const { items } = await leerCuracion();
  const faltantes = [];

  for (const chunk of chunks) {
    // Los chunks que ya vienen curados desde el fetch (ej. la ley) se saltean.
    if (chunk.tema) continue;

    const entrada = items[chunk.clave];
    if (!entrada || !entrada.tema) {
      faltantes.push(chunk.clave);
      continue;
    }
    chunk.tema = entrada.tema;
    chunk.articulos = entrada.articulos || [];
  }

  if (faltantes.length) {
    throw new Error(
      `[curar] ${faltantes.length} chunk(s) sin curar en corpus/curacion.json. ` +
      `Corré 'node ingesta/curar.js --scaffold' y completá:\n  - ` +
      faltantes.join('\n  - ')
    );
  }
  return chunks;
}

// --- Scaffold: genera/actualiza el esqueleto de curación ---
async function scaffold() {
  const chunks = await obtenerChunks();
  const actual = await leerCuracion();
  const items = actual.items || {};

  let nuevos = 0;
  for (const chunk of chunks) {
    if (chunk.tema) continue;                 // la ley no se cura a mano
    if (items[chunk.clave]) continue;         // ya editado: no pisar
    items[chunk.clave] = {
      tema: temaSugerido(chunk.seccion),      // SUGERIDO — revisar
      articulos: []                            // completar con las citas
    };
    nuevos++;
  }

  const salida = {
    _descripcion:
      'Curación manual del corpus. Clave = texto de la pregunta. Revisá el `tema` ' +
      'sugerido y completá `articulos` (ej. ["Ley 24.240 Art. 11"]). ' +
      'La ley 24.240 NO va acá (se cura sola por artículo).',
    items
  };
  await writeFile(CURACION, JSON.stringify(salida, null, 2) + '\n', 'utf-8');
  console.log(
    `[curar] Scaffold actualizado: ${nuevos} clave(s) nueva(s), ` +
    `${Object.keys(items).length} total. Revisá corpus/curacion.json.`
  );
}

// CLI
const esMain = import.meta.url === `file://${process.argv[1]}`;
if (esMain && process.argv.includes('--scaffold')) {
  scaffold().catch((e) => {
    console.error('[curar] ERROR:', e.message);
    process.exit(1);
  });
}
