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
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

const MODELO_EMBED = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const UMBRAL_EVIDENCIA = 0.012; // calibrar en Fase 3 contra el golden set

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// System prompt FIJO (se cachea en Groq → no consume cuota extra).
// Es el núcleo del grounding estricto: el LLM no puede inventar ni opinar.
const SYSTEM_PROMPT = `Sos Garrón, un asistente de derechos del consumidor en Argentina.
Respondé ÚNICAMENTE con base en los fragmentos oficiales que te paso como contexto.
Reglas estrictas:
- Si los fragmentos no alcanzan para responder, decí que no tenés información oficial
  suficiente y sugerí consultar la Ventanilla Única Federal. No inventes.
- Citá SIEMPRE el o los artículos que aparecen en los fragmentos (ej. "Ley 24.240, Art. 11").
- No des asesoramiento legal sobre el caso particular; orientá e informá.
- Estructurá la respuesta en: qué te corresponde / fundamento / cómo reclamar.
- Tono claro y llano, español rioplatense, sin tecnicismos innecesarios.`;

let extractor: any = null;
async function embed(texto: string): Promise<number[]> {
  if (!extractor) extractor = await pipeline('feature-extraction', MODELO_EMBED);
  const salida = await extractor(texto, { pooling: 'mean', normalize: true });
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

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

    // 4. Umbral de evidencia
    const mejor = chunks?.[0]?.score ?? 0;
    if (!chunks?.length || mejor < UMBRAL_EVIDENCIA) {
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
