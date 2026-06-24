// ingesta/fetch.js
// Descarga las fuentes del inventario y las parsea a chunks.
//
// Las guías "Ley Simple" / "Derecho Fácil" vienen en pares pregunta-respuesta:
// los encabezados de pregunta (h5) seguidos de su respuesta. Cada par = un chunk
// autocontenido, que es la unidad ideal para recuperar y citar.
//
// La Ley 24.240 (capa 2) se chunkea por artículo.
//
// DISCIPLINA ANTI-FALLO-SILENCIOSO: si una fuente devuelve 0 chunks, se ABORTA
// con error en vez de continuar. Un corpus vacío cargado en silencio es peor que
// un fallo visible.

import { readFile } from 'node:fs/promises';
// 'cheerio/slim' evita el entrypoint que carga undici (incompatible con Node 18).
// Solo usamos cheerio.load, que slim provee.
import * as cheerio from 'cheerio/slim';

const INVENTARIO = new URL('./corpus/fuentes.json', import.meta.url);
const COMPLEMENTOS = new URL('./corpus/complementos.json', import.meta.url);

// Algunos sitios de gob.ar varían la respuesta (o la bloquean) según el cliente.
// Nos identificamos como un navegador y pedimos español.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; GarronBot/1.0; +corpus oficial Defensa del Consumidor)',
  'Accept-Language': 'es-AR,es;q=0.9'
};

// Colapsa espacios/saltos múltiples en un solo espacio. Cheerio concatena el
// texto de muchos nodos y deja espaciado sucio que ensucia el embedding y el FTS.
function normalizar(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

// cheerio.text() concatena el texto de TODOS los nodos, incluidos <script> y
// <style>: sin esto, el código JS del visor de normas terminaba pegado al
// último chunk. Los borramos del DOM antes de extraer texto.
function limpiarDOM($) {
  $('script, style, noscript').remove();
}

// Recorta el pie de página del sitio de normativa ("Acerca de esta norma" y
// todo lo que sigue: Resumen, Norma original, Buscador...), que cheerio mete en
// el último artículo/cláusula.
function sinPie(texto) {
  const pie = texto.search(/Acerca de esta norma/i);
  return pie >= 0 ? texto.slice(0, pie).trim() : texto;
}

// Parsea una guía Ley Simple / Derecho Fácil a pares pregunta-respuesta.
// Exportada para poder testearla contra fixtures (ver fetch.test.js).
//
// Estructura real (verificada contra el HTML de argentina.gob.ar, 2026-06):
//   <main>
//     <h3>La garantía</h3>            ← sección temática
//     <h5>¿Qué es la garantía?</h5>   ← pregunta
//     <p>...</p> <ul>...</ul>         ← respuesta (hermanos hasta el próximo h5/h3)
//   </main>
// Acotamos a <main> para no tragar el footer del sitio ("Trámites", etc.).
// Encabezados h5 que NO son preguntas sino navegación al pie de la guía.
const H5_NAV = new Set(['mas informacion', 'volver al indice']);

export function parsearGuia($, fuente) {
  limpiarDOM($);
  const chunks = [];
  $('main h5').each((_, el) => {
    const pregunta = normalizar($(el).text());
    if (H5_NAV.has(slugSeccion(pregunta))) return;   // saltar links de navegación
    // Sección temática = el h3 más cercano por encima. Sirve de sugerencia de
    // 'tema' para la curación manual (ver curar.js); no es el tema final.
    const seccion = normalizar($(el).prevAll('h3').first().text());
    // Recolectar el contenido siguiente hasta la próxima pregunta o sección.
    let respuesta = '';
    let sig = $(el).next();
    while (sig.length && !['H5', 'H4', 'H3', 'H2'].includes(sig.prop('tagName'))) {
      respuesta += ' ' + sig.text().trim();
      sig = sig.next();
    }
    respuesta = normalizar(respuesta);
    if (pregunta && respuesta) {
      chunks.push({
        clave: pregunta,     // clave estable para mapear en la curación
        seccion,             // sugerencia de tema (h3 de la sección)
        content: `${pregunta}\n${respuesta}`,
        tema: null,          // se asigna en la curación de metadata (curar.js)
        articulos: [],       // se curan después
        fuente_url: fuente.url,
        fuente_titulo: fuente.titulo,
        fuente_fecha: fuente.actualizado || null
      });
    }
  });
  return chunks;
}

// Normaliza un título a slug comparable (minúsculas, sin acentos). Para decidir
// qué secciones son ruido/navegación y no contenido.
function slugSeccion(texto) {
  return normalizar(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Secciones que son navegación o duplican otra capa del corpus, NO contenido.
// "texto completo de la norma" remite a la ley entera → ya la cubre la capa 2
// (parsearLey). Decisión de curación: no duplicar.
const SECCIONES_IGNORADAS = new Set([
  'en esta pagina',
  'volver al indice',
  'texto completo de la norma',
  'normas complementarias'
]);

// Parsea una guía con estructura de SECCIONES (no de preguntas): cada <h3> es un
// tema y su respuesta es la prosa que le sigue hasta el próximo h3/h2. La usan las
// páginas tipo "consumo-economia" (cláusulas-prohibidas) y "ventanilla-unica",
// que no traen preguntas <h5>. Un chunk por sección temática.
// Exportada para testearla contra fixtures (ver fetch.test.js).
export function parsearSeccion($, fuente) {
  limpiarDOM($);
  const chunks = [];
  $('main h3').each((_, el) => {
    const titulo = normalizar($(el).text());
    if (!titulo || SECCIONES_IGNORADAS.has(slugSeccion(titulo))) return;
    // Recolectar los hermanos siguientes hasta la próxima sección (h3/h2).
    let cuerpo = '';
    let sig = $(el).next();
    while (sig.length && !['H3', 'H2'].includes(sig.prop('tagName'))) {
      cuerpo += ' ' + sig.text().trim();
      sig = sig.next();
    }
    cuerpo = normalizar(cuerpo);
    if (cuerpo) {
      chunks.push({
        // Clave única por fuente: los títulos de sección ("Funciones") pueden
        // repetirse entre páginas; el id de la fuente los desambigua en la curación.
        clave: `${fuente.id} :: ${titulo}`,
        seccion: titulo,
        content: `${titulo}\n${cuerpo}`,
        tema: null,
        articulos: [],
        fuente_url: fuente.url,
        fuente_titulo: fuente.titulo,
        fuente_fecha: fuente.actualizado || null
      });
    }
  });
  return chunks;
}

// Detecta el ENCABEZADO de un artículo (no las referencias en el texto).
// Un encabezado real es: "Artículo|ARTICULO N [º°]" seguido de un separador
// (— · - · .). Las referencias dentro del texto ("artículo 37 de la Ley...",
// "Artículo 770 del CCyC") van seguidas de "de/del/," → no matchean.
// Esto evita los artículos fantasma que inflaban el conteo (ej. Ley 24.240
// daba 75 "artículos" cuando tiene 66).
// Acepta la palabra completa ("ARTICULO"/"Artículo") y la forma abreviada
// ("Art.") que usan muchos decretos/resoluciones del art. 2 en adelante.
const ENCABEZADO_ART = /(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s*\d+\s*[º°]?\s*[—.\-]/;
const NUM_ART = /^(?:ART[IÍ]CULO|Art[ií]culo|Art\.)\s*(\d+)/;

// Parsea un texto legal (ley, decreto) a un chunk por artículo. La cita base
// (ej. "Ley 24.240", "Decreto 274/2019") viene de fuente.cita: parametrizada
// para servir a cualquier norma de capa 2, no solo a la Ley 24.240.
export function parsearLey($, fuente) {
  limpiarDOM($);
  const cita = fuente.cita || fuente.titulo;
  const chunks = [];
  const vistos = new Set();   // dedup por número de artículo (anexos reinician)
  // Apuntar al contenedor de contenido en vez de a todo el <body>, para no
  // arrastrar nav/footer/scripts como ruido.
  const $main = $('main, article, #contenido, .contenido').first();
  const texto = sinPie(normalizar(($main.length ? $main : $('body')).text()));
  const partes = texto.split(new RegExp(`(?=${ENCABEZADO_ART.source})`, 'g'));
  for (const parte of partes) {
    const limpio = parte.trim();
    const m = limpio.match(NUM_ART);
    if (m && limpio.length > 40) {
      if (vistos.has(m[1])) continue;   // ya tomamos este artículo
      vistos.add(m[1]);
      chunks.push({
        clave: `${cita} Art. ${m[1]}`,   // ya curado: la norma no necesita curación manual
        seccion: 'norma_completa',
        // Guardamos el artículo completo (para citar). El embedding solo cubrirá
        // los primeros ~128 tokens; embeddings.js avisa si es muy largo.
        content: limpio,
        tema: 'norma_completa',
        articulos: [`${cita} Art. ${m[1]}`],
        fuente_url: fuente.url,
        fuente_titulo: fuente.titulo,
        fuente_fecha: fuente.actualizado || null
      });
    }
  }
  return chunks;
}

// Parsea el ANEXO de una resolución que enumera ítems con letras: "a) ... b) ...".
// Cada ítem = un chunk citable. La usan resoluciones cuyo contenido sustantivo
// vive en un anexo enumerado (ej. Res. 53/2003: la lista de cláusulas abusivas),
// no en artículos. La cita base viene de fuente.cita.
export function parsearAnexo($, fuente) {
  limpiarDOM($);
  const cita = fuente.cita || fuente.titulo;
  const chunks = [];
  const $main = $('main, article, #contenido, .contenido').first();
  const texto = sinPie(normalizar(($main.length ? $main : $('body')).text()));
  // El ENCABEZADO de un anexo va en MAYÚSCULAS ("ANEXO", "ANEXO I", "ANEXO II"),
  // a diferencia de las menciones "Anexo" (mixto) en considerandos/artículos.
  // Una norma puede traer varios anexos sectoriales (ej. Res. 9/2004: I medicina
  // prepaga, II comunicaciones, III servicios financieros). Partimos por cada
  // encabezado en mayúsculas; todo lo previo (considerandos, articulado) se
  // descarta solo, porque no cae dentro de ninguna sección de anexo.
  const headers = [...texto.matchAll(/\bANEXO(?:\s+([IVXLCDM]+))?\b/g)];
  for (let i = 0; i < headers.length; i++) {
    const label = headers[i][1] || '';                       // "I", "II"... o ""
    const ini = headers[i].index;
    const fin = i + 1 < headers.length ? headers[i + 1].index : texto.length;
    const seccion = texto.slice(ini, fin);
    // Separar por marcador de ítem letrado al inicio: "a) ", "b) "...
    for (const item of seccion.split(/(?=\b[a-zñ]\)\s)/i)) {
      const limpio = item.trim();
      const m = limpio.match(/^([a-zñ])\)/i);
      if (m && limpio.length > 40) {
        const letra = m[1].toLowerCase();
        const ref = `Anexo${label ? ` ${label}` : ''} ${letra})`;
        chunks.push({
          clave: `${cita} ${ref}`,
          seccion: 'norma_completa',
          content: limpio,
          tema: 'norma_completa',
          articulos: [`${cita} ${ref}`],
          fuente_url: fuente.url,
          fuente_titulo: fuente.titulo,
          fuente_fecha: fuente.actualizado || null
        });
      }
    }
  }
  return chunks;
}

export async function obtenerChunks() {
  const inventario = JSON.parse(await readFile(INVENTARIO, 'utf-8'));
  const todos = [];

  for (const fuente of inventario.fuentes) {
    console.log(`[fetch] ${fuente.titulo}`);
    const res = await fetch(fuente.url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Fetch falló (${res.status}) para ${fuente.url}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // El parser se elige por la plantilla de la fuente (campo `parser` en
    // fuentes.json). Default 'guia' = preguntas h5 (la plantilla más común).
    const parser = fuente.parser || (fuente.id === 'ley-24240' ? 'ley' : 'guia');
    const chunks =
      parser === 'ley' ? parsearLey($, fuente)
      : parser === 'anexo' ? parsearAnexo($, fuente)
      : parser === 'seccion' ? parsearSeccion($, fuente)
      : parsearGuia($, fuente);

    // ANTI-FALLO-SILENCIOSO
    if (chunks.length === 0) {
      throw new Error(
        `[fetch] ${fuente.id} devolvió 0 chunks. ¿Cambió el HTML de la fuente? ` +
        `Abortando para no cargar un corpus vacío.`
      );
    }

    console.log(`[fetch]   → ${chunks.length} chunks`);
    todos.push(...chunks);
  }

  // Complementos de capa 1 hechos a mano (síntesis de artículos oficiales para
  // cubrir consultas frecuentes que las guías no responden). Pre-curados.
  const complementos = await leerComplementos();
  if (complementos.length) {
    console.log(`[fetch] Complementos (síntesis a mano): ${complementos.length}`);
    todos.push(...complementos);
  }

  console.log(`[fetch] Total: ${todos.length} chunks (${inventario.fuentes.length} fuentes + ${complementos.length} complementos).`);
  return todos;
}

// Carga los complementos a mano y los devuelve con forma de chunk (pre-curados:
// ya traen tema + articulos, así que se saltean la curación manual). Si el
// archivo no existe, devuelve [] (son opcionales).
async function leerComplementos() {
  let data;
  try {
    data = JSON.parse(await readFile(COMPLEMENTOS, 'utf-8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  return (data.items || []).map((it) => ({
    clave: it.clave,
    seccion: 'complemento',
    content: `${it.clave}\n${it.respuesta}`,
    tema: it.tema,
    articulos: it.articulos || [],
    fuente_url: it.fuente_url,
    fuente_titulo: it.fuente_titulo,
    fuente_fecha: it.fuente_fecha || null
  }));
}
