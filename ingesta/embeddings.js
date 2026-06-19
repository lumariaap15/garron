// ingesta/embeddings.js
// Genera embeddings localmente con Transformers.js — sin API, sin costo.
// Modelo: paraphrase-multilingual-MiniLM-L12-v2 (384 dimensiones, optimizado para español).
// IMPORTANTE: el mismo modelo debe usarse en ingesta y en consulta. Si cambia el
// modelo, hay que re-generar TODOS los embeddings (el esquema no cambia si mantenés 384d).

import { pipeline } from '@xenova/transformers';

const MODELO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

let extractor = null;

// Carga perezosa del modelo (se descarga la primera vez, después queda cacheado)
async function getExtractor() {
  if (!extractor) {
    console.log(`[embeddings] Cargando modelo ${MODELO}...`);
    extractor = await pipeline('feature-extraction', MODELO);
    console.log('[embeddings] Modelo listo.');
  }
  return extractor;
}

// Genera el embedding de un texto. Devuelve un array de 384 floats normalizados.
export async function embed(texto) {
  const ext = await getExtractor();
  const salida = await ext(texto, { pooling: 'mean', normalize: true });
  return Array.from(salida.data);
}

// Genera embeddings para varios textos (uno por uno; el corpus es chico).
export async function embedLote(textos) {
  const vectores = [];
  for (let i = 0; i < textos.length; i++) {
    vectores.push(await embed(textos[i]));
    if ((i + 1) % 10 === 0) console.log(`[embeddings] ${i + 1}/${textos.length}`);
  }
  return vectores;
}

export const DIMENSIONES = 384;
export const NOMBRE_MODELO = MODELO;
