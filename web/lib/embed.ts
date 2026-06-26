// web/lib/embed.ts — SOLO server. Embedding de la consulta con el MISMO modelo y
// prefijo que la ingesta (ingesta/embeddings.js): e5-small + "query: ". Si esto
// no coincide con cómo se embebió el corpus, los vectores no son comparables.
import 'server-only';
import { pipeline } from '@xenova/transformers';

const MODELO = 'Xenova/multilingual-e5-small';

// El modelo se carga una vez y queda en memoria del proceso Node (next start).
let extractor: any = null;
let cargando: Promise<any> | null = null;
async function getExtractor() {
  if (extractor) return extractor;
  if (!cargando) cargando = pipeline('feature-extraction', MODELO).then((e) => (extractor = e));
  return cargando;
}

export async function embedConsulta(texto: string): Promise<number[]> {
  const ext = await getExtractor();
  const salida = await ext('query: ' + texto, { pooling: 'mean', normalize: true });
  return Array.from(salida.data as Float32Array);
}
