// web/app/api/consulta/route.ts
// Backend de Garrón como API route de Next (corre en el proceso Node, no edge).
// Flujo: derivación → embedding e5 → buscar_hibrido → compuerta fts_score → LLM
// (OpenRouter) con grounding estricto, que devuelve JSON estructurado → Ficha.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedConsulta } from "@/lib/embed";
import { VENTANILLA_URL, type RespuestaConsulta } from "@/lib/consulta";
import type { Ficha } from "@/lib/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Dev local: si las vars no están en el entorno de Next (web/.env.local), intentar
// el .env de la raíz del monorepo. En prod (Railway) las vars vienen del dashboard.
if (!process.env.OPEN_ROUTER_API_KEY && typeof (process as any).loadEnvFile === "function") {
  try { (process as any).loadEnvFile(new URL("../../../../.env", import.meta.url).pathname); } catch {}
}

const PISO_EVIDENCIA = 0.3;
const MODELO_LLM = "openai/gpt-oss-120b:free";
const LLM_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `Sos Garrón, un asistente de derechos del consumidor en Argentina.
Respondé ÚNICAMENTE con base en los fragmentos oficiales que te paso como contexto.
Devolvé SOLO un objeto JSON válido (sin texto afuera) con esta forma exacta:
{
  "suficiente": boolean,
  "queTeCorresponde": "string",
  "pasos": ["string", "string"]
}
Reglas:
- "suficiente" = false si los fragmentos NO responden la pregunta puntual del usuario
  (aunque traten un tema cercano). En ese caso dejá queTeCorresponde y pasos vacíos.
- "queTeCorresponde": explicación clara y llana de qué le corresponde, en español
  rioplatense. Marcá con **dobles asteriscos** lo importante (plazos, opciones).
  No inventes nada que no esté en los fragmentos. No cites artículos acá (los pongo yo).
- "pasos": lista de pasos concretos para reclamar (3 a 5).
- No des asesoramiento legal sobre el caso particular; orientá e informá.`;

function clienteSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

// Paso 1 — derivación determinística (casos fuera de alcance).
async function detectarDerivacion(sb: ReturnType<typeof clienteSupabase>, consulta: string) {
  const { data } = await sb.from("derivaciones").select("*");
  if (!data) return null;
  const t = consulta.toLowerCase();
  return data.find((d: any) => t.includes(String(d.patron).toLowerCase())) ?? null;
}

// Arma los artículos citables desde la metadata REAL de los chunks (no del LLM):
// cada artículo apunta a la URL oficial de su fuente. Dedup por etiqueta.
function articulosDeChunks(chunks: any[]): Ficha["articulos"] {
  const vistos = new Map<string, string>();
  for (const c of chunks) {
    for (const etiqueta of c.articulos || []) {
      if (!vistos.has(etiqueta)) vistos.set(etiqueta, c.fuente_url);
    }
  }
  return Array.from(vistos.entries()).slice(0, 6).map(([etiqueta, url]) => ({ etiqueta, url }));
}

async function redactar(consulta: string, chunks: any[]) {
  const contexto = chunks
    .map((c, i) => `[Fragmento ${i + 1}] ${c.content}\nArtículos: ${(c.articulos || []).join(", ")}`)
    .join("\n\n");
  const res = await fetch(LLM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://garron.app",
      "X-Title": "Garrón",
    },
    body: JSON.stringify({
      model: MODELO_LLM,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Consulta del usuario: ${consulta}\n\nFragmentos oficiales:\n${contexto}` },
      ],
    }),
  });
  if (res.status === 429) return { rateLimited: true } as const;
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return { parsed: JSON.parse(raw) } as const;
}

export async function POST(req: Request) {
  try {
    const { consulta } = await req.json();
    if (!consulta || typeof consulta !== "string") {
      return NextResponse.json<RespuestaConsulta>({ tipo: "error", mensaje: "Falta la consulta." }, { status: 400 });
    }
    const sb = clienteSupabase();

    // 1. Derivación
    const deriv = await detectarDerivacion(sb, consulta);
    if (deriv) {
      return NextResponse.json<RespuestaConsulta>({
        tipo: "derivacion", mensaje: deriv.mensaje, organismo: deriv.organismo, url: deriv.url,
      });
    }

    // 2-3. Embedding + búsqueda híbrida
    const queryEmbedding = await embedConsulta(consulta);
    const { data: chunks, error } = await sb.rpc("buscar_hibrido", {
      query_text: consulta, query_embedding: queryEmbedding, match_count: 4,
    });
    if (error) throw error;

    // 4. Compuerta de dominio
    const ftsScore = chunks?.[0]?.fts_score ?? 0;
    const sinEvidencia: RespuestaConsulta = {
      tipo: "sin_evidencia",
      mensaje: "No tengo información oficial suficiente para responder esto con certeza. Te recomiendo consultar la Ventanilla Única Federal de Defensa del Consumidor.",
      url: VENTANILLA_URL,
    };
    if (!chunks?.length || ftsScore < PISO_EVIDENCIA) return NextResponse.json(sinEvidencia);

    // 5. Redacción con grounding (JSON)
    const r = await redactar(consulta, chunks);
    if ("rateLimited" in r) {
      return NextResponse.json<RespuestaConsulta>(
        { tipo: "error", mensaje: "Hay muchas consultas ahora mismo. Probá de nuevo en unos segundos." },
        { status: 429 },
      );
    }
    if (!r.parsed?.suficiente) return NextResponse.json(sinEvidencia);

    const ficha: Ficha = {
      consulta,
      queTeCorresponde: String(r.parsed.queTeCorresponde || ""),
      articulos: articulosDeChunks(chunks),
      pasos: Array.isArray(r.parsed.pasos) ? r.parsed.pasos.map(String) : [],
      cta: { label: "Iniciar reclamo en Ventanilla Única", url: VENTANILLA_URL },
      nota: "Basado en fuentes oficiales (Ley 24.240 y normativa complementaria) · orientación informativa, no asesoramiento legal",
    };
    return NextResponse.json<RespuestaConsulta>({ tipo: "respuesta", ficha });
  } catch (e) {
    return NextResponse.json<RespuestaConsulta>(
      { tipo: "error", mensaje: "Hubo un problema procesando tu consulta. Probá de nuevo." },
      { status: 500 },
    );
  }
}
