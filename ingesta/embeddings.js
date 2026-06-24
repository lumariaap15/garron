// ingesta/embeddings.js
// Genera embeddings localmente con Transformers.js — sin API, sin costo.
// Modelo: multilingual-e5-small (384 dimensiones, fuerte en retrieval multilingüe).
//
// e5 REQUIERE prefijos: "query: " para consultas, "passage: " para documentos.
// Sin ellos el rendimiento cae fuerte. El MISMO modelo y los MISMOS prefijos
// deben usarse en ingesta y en consulta (ver consulta/index.ts). Si se cambia el
// modelo, hay que re-generar TODOS los embeddings (el esquema no cambia si seguís en 384d).

import { pipeline } from '@xenova/transformers';

const MODELO = 'Xenova/multilingual-e5-small';

// Prefijos de e5. Si algún día se vuelve a un modelo sin prefijos, dejar '' en ambos.
const PREFIJO = { query: 'query: ', passage: 'passage: ' };

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

// Con parent-child los hijos ya entran enteros en la ventana (~128 tokens). Este
// aviso solo debería saltar si una oración suelta es larguísima (caso raro).
const LIMITE_PALABRAS_AVISO = 110;

// Genera el embedding de un texto. `tipo` = 'passage' (documento) | 'query' (consulta).
// Devuelve un array de 384 floats normalizados.
export async function embed(texto, tipo = 'passage') {
  const ext = await getExtractor();
  const palabras = texto.trim().split(/\s+/).length;
  if (palabras > LIMITE_PALABRAS_AVISO) {
    console.warn(
      `[embeddings] ⚠ fragmento de ~${palabras} palabras > ${LIMITE_PALABRAS_AVISO}: ` +
      `el embedding solo cubre los primeros ~128 tokens.`
    );
  }
  const entrada = (PREFIJO[tipo] ?? '') + texto;
  const salida = await ext(entrada, { pooling: 'mean', normalize: true, truncation: true });
  return Array.from(salida.data);
}

// ------------------------------------------------------------
// Chunking parent → hijos: ventanas de ~80 palabras por oración, solape de 1.
// Cada hijo entra entero en la ventana del modelo → sin truncación.
// ------------------------------------------------------------
const LIMITE_PALABRAS_HIJO = 80;
const cuentaPalabras = (s) => s.trim().split(/\s+/).length;

export function dividirEnHijos(texto) {
  const limpio = texto.trim();
  if (cuentaPalabras(limpio) <= LIMITE_PALABRAS_HIJO) return [limpio];

  // Partir en oraciones (corta tras . ? ! manteniendo el signo).
  const oraciones = (limpio.match(/[^.?!]+[.?!]*/g) || [limpio])
    .map((s) => s.trim())
    .filter(Boolean);

  const hijos = [];
  let win = [];
  let count = 0;
  for (const o of oraciones) {
    const w = cuentaPalabras(o);
    // Si agregar esta oración excede el límite y ya hay algo en la ventana, cerrar.
    if (count + w > LIMITE_PALABRAS_HIJO && win.length) {
      hijos.push(win.join(' '));
      const ultima = win[win.length - 1];
      // Solape de 1 oración para no cortar contexto, salvo que esa oración ya
      // sea enorme (en cuyo caso arrancamos limpio para no arrastrarla).
      if (cuentaPalabras(ultima) < LIMITE_PALABRAS_HIJO) {
        win = [ultima];
        count = cuentaPalabras(ultima);
      } else {
        win = [];
        count = 0;
      }
    }
    win.push(o);
    count += w;
  }
  if (win.length) hijos.push(win.join(' '));
  return hijos;
}

// Genera embeddings para varios textos (uno por uno; el corpus es chico).
export async function embedLote(textos, tipo = 'passage') {
  const vectores = [];
  for (let i = 0; i < textos.length; i++) {
    vectores.push(await embed(textos[i], tipo));
    if ((i + 1) % 10 === 0) console.log(`[embeddings] ${i + 1}/${textos.length}`);
  }
  return vectores;
}

export const DIMENSIONES = 384;
export const NOMBRE_MODELO = MODELO;
