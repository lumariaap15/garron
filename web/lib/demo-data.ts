/**
 * Datos estáticos para mapear la interfaz (Fase 5, sin funcionalidad real).
 *
 * La forma espeja el contrato que ya devuelve la Edge Function `consulta`
 * (ver consulta/index.ts → { tipo, respuesta, fuentes[] }). Cuando se conecte
 * la Fase 4, esto se reemplaza por un `fetch` a la función; la UI no cambia.
 */

export interface CategoriaProblema {
  id: string;
  label: string;
  disponible: boolean; // las no disponibles se ven atenuadas, como en el diseño
}

export const CATEGORIAS: CategoriaProblema[] = [
  { id: "producto-roto", label: "Me llegó el producto roto", disponible: true },
  {
    id: "devolver-online",
    label: "Quiero devolver algo que compré online",
    disponible: true,
  },
  {
    id: "arrepentimiento",
    label: "Me arrepentí de una compra por internet",
    disponible: true,
  },
  {
    id: "garantia",
    label: "No me quieren aceptar la garantía",
    disponible: false,
  },
];

export interface Articulo {
  etiqueta: string; // "Ley 24.240, Art. 11"
  url: string;
}

export interface Ficha {
  consulta: string;
  /** Texto de "Qué te corresponde". Los **dobles asteriscos** marcan negrita. */
  queTeCorresponde: string;
  articulos: Articulo[];
  pasos: string[];
  cta: { label: string; url: string };
  nota: string;
}

const VENTANILLA_URL =
  "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario";

/** Ficha de ejemplo (la del mockup): "Me arrepentí de una compra por internet". */
export const FICHA_DEMO: Ficha = {
  consulta: "Me arrepentí de una compra por internet",
  queTeCorresponde:
    "La garantía legal sobre productos nuevos es de **6 meses** desde la fecha de compra. " +
    "Mientras el artículo está en reparación, ese plazo **se suspende** — y retoma cuando vuelve a tus manos. " +
    "Si el service no resolvió el problema dentro de ese período, podés elegir entre tres opciones: " +
    "**sustitución** por un producto nuevo, **reembolso total** del precio pagado, o " +
    "**descuento proporcional** al defecto.",
  articulos: [
    {
      etiqueta: "Ley 24.240, Art. 11",
      url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm",
    },
    {
      etiqueta: "Ley 24.240, Art. 17",
      url: "http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm",
    },
  ],
  pasos: [
    "Guardá la factura de compra y el comprobante de ingreso al servicio técnico.",
    "Presentá un reclamo escrito a la empresa vendedora o al fabricante, indicando el defecto y el tiempo transcurrido sin resolución.",
    "Si no obtenés respuesta en 30 días, iniciá tu reclamo en la Ventanilla Única Federal de Defensa del Consumidor.",
  ],
  cta: { label: "Iniciar reclamo en Ventanilla Única", url: VENTANILLA_URL },
  nota: "Basado en la Ley 24.240 · actualizada a feb-2025 · orientación informativa, no asesoramiento legal",
};
