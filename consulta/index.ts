// consulta/index.ts
// Supabase Edge Function (Deno) — endpoint principal de Garrón.
//
// Flujo:
//   1. ¿Caso fuera de alcance? → derivar (sin LLM, gratis)
//   2. Embedding de la consulta (mismo modelo que la ingesta)
//   3. Búsqueda híbrida (RPC a buscar_hibrido)
//   4. ¿Evidencia suficiente? → si no, "sin fundamento" + derivar
//   5. LLM (Groq) redacta SOLO con los chunks, citando artículo y fuente
//
// Deploy:  supabase functions deploy consulta

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pipeline } from 'https://esm.sh/@xenova/transformers@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;
const OPEN_ROUTER_API_KEY = Deno.env.get('OPEN_ROUTER_API_KEY')!;

const MODELO_EMBED = 'Xenova/multilingual-e5-small'; // mismo modelo que la ingesta
// OpenRouter (API OpenAI-compatible). ':free' = sin costo, con rate limit más
// estricto; para producción conviene una variante paga o agregar saldo. El Llama
// 70B free está muy saturado (429); gpt-oss-120b respondió bien y cita correcto.
const MODELO_LLM = 'openai/gpt-oss-120b:free';
const LLM_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Piso de DOMINIO sobre fts_score (señal léxica OR a nivel consulta). Calibrado
// contra el golden set: reales ≥0.4, "capital de Francia"=0.2 → 0.3 con margen.
// Los negativos ambiguos que comparten vocabulario (ej. "importar auto") pasan
// este filtro grueso y los frena el grounding estricto del LLM (segunda capa).
const PISO_EVIDENCIA = 0.3;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// System prompt FIJO. Es el núcleo del grounding estricto: el LLM no puede
// inventar ni opinar; responde solo con los fragmentos y cita el artículo.
const SYSTEM_PROMPT = `Sos Garrón, un asistente de derechos del consumidor en Argentina.
Respondé ÚNICAMENTE con base en los fragmentos oficiales que te paso como contexto.
Reglas estrictas:
- Si los fragmentos no alcanzan para responder, decí que no tenés información oficial
  suficiente y sugerí consultar la Ventanilla Única Federal. No inventes.
- Si los fragmentos tratan un tema CERCANO pero no responden la pregunta puntual del
  usuario, NO respondas con ellos como si aplicaran: aclará que no tenés información
  oficial sobre ese punto específico. No fuerces una respuesta con datos que no corresponden.
- Citá SIEMPRE el o los artículos que aparecen en los fragmentos (ej. "Ley 24.240, Art. 11").
- No des asesoramiento legal sobre el caso particular; orientá e informá.
- Estructurá la respuesta en: qué te corresponde / fundamento / cómo reclamar.
- Tono claro y llano, español rioplatense, sin tecnicismos innecesarios.`;

let extractor: any = null;
// e5 requiere el prefijo "query: " en las consultas (los documentos se embeben
// con "passage: " en la ingesta). Debe coincidir con ingesta/embeddings.js.
async function embed(texto: string): Promise<number[]> {
  if (!extractor) extractor = await pipeline('feature-extraction', MODELO_EMBED);
  const salida = await extractor('query: ' + texto, { pooling: 'mean', normalize: true });
  return Array.from(salida.data);
}

// Paso 1 — derivación determinística
async function detectarDerivacion(consulta: string) {
  const { data } = await supabase.from('derivaciones').select('*');
  if (!data) return null;
  const texto = consulta.toLowerCase();
  for (const d of data) {
    if (texto.includes(d.patron.toLowerCase())) return d;
  }
  return null;
}

// Paso 5 — llamada al LLM con grounding
async function redactar(consulta: string, chunks: any[]) {
  const contexto = chunks
    .map((c, i) => `[Fragmento ${i + 1}] ${c.content}\nArtículos: ${(c.articulos || []).join(', ')}\nFuente: ${c.fuente_url}`)
    .join('\n\n');

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // Headers opcionales de OpenRouter para identificar la app (ranking/atribución).
      'HTTP-Referer': 'https://garron.app',
      'X-Title': 'Garrón',
    },
    body: JSON.stringify({
      model: MODELO_LLM,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Consulta del usuario: ${consulta}\n\nFragmentos oficiales:\n${contexto}` },
      ],
      temperature: 0.2,
    }),
  });

  if (res.status === 429) {
    return { error: 'rate_limit', retryAfter: res.headers.get('retry-after') };
  }
  const data = await res.json();
  return { texto: data.choices?.[0]?.message?.content ?? '' };
}

Deno.serve(async (req) => {
  try {
    const { consulta } = await req.json();
    if (!consulta || typeof consulta !== 'string') {
      return Response.json({ error: 'Falta la consulta' }, { status: 400 });
    }

    // 1. Derivación
    const deriv = await detectarDerivacion(consulta);
    if (deriv) {
      return Response.json({
        tipo: 'derivacion',
        mensaje: deriv.mensaje,
        organismo: deriv.organismo,
        url: deriv.url,
      });
    }

    // 2. Embedding
    const queryEmbedding = await embed(consulta);

    // 3. Búsqueda híbrida
    const { data: chunks, error } = await supabase.rpc('buscar_hibrido', {
      query_text: consulta,
      query_embedding: queryEmbedding,
      match_count: 4,
    });
    if (error) throw error;

    // 4. Compuerta de evidencia por DOMINIO: fts_score (relevancia léxica OR a
    //    nivel consulta) por debajo del piso → fuera de tema. El score de RRF es
    //    solo posicional, no sirve para esto. Es un filtro grueso; el grounding
    //    del LLM es la segunda capa para los ambiguos.
    const ftsScore = chunks?.[0]?.fts_score ?? 0;
    if (!chunks?.length || ftsScore < PISO_EVIDENCIA) {
      return Response.json({
        tipo: 'sin_evidencia',
        mensaje: 'No tengo información oficial suficiente para responder esto con certeza. Te recomiendo consultar la Ventanilla Única Federal de Defensa del Consumidor.',
        url: 'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario',
      });
    }

    // 5. Redacción con grounding
    const resp = await redactar(consulta, chunks);
    if (resp.error === 'rate_limit') {
      return Response.json(
        { error: 'rate_limit', mensaje: 'Demasiadas consultas por ahora, probá en unos segundos.' },
        { status: 429 },
      );
    }

    return Response.json({
      tipo: 'respuesta',
      respuesta: resp.texto,
      fuentes: chunks.map((c: any) => ({
        articulos: c.articulos,
        url: c.fuente_url,
        titulo: c.fuente_titulo,
        fecha: c.fuente_fecha,
      })),
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
