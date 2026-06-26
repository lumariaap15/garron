// web/lib/consulta.ts — contrato compartido entre el API route y la UI.
import type { Ficha } from "@/lib/demo-data";

export type RespuestaConsulta =
  | { tipo: "respuesta"; ficha: Ficha }
  | { tipo: "derivacion"; mensaje: string; organismo?: string; url?: string }
  | { tipo: "sin_evidencia"; mensaje: string; url: string }
  | { tipo: "error"; mensaje: string };

export const VENTANILLA_URL =
  "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";
