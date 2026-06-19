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
import * as cheerio from 'cheerio';

const INVENTARIO = new URL('./corpus/fuentes.json', import.meta.url);

// Parsea una guía Ley Simple / Derecho Fácil a pares pregunta-respuesta.
function parsearGuia($, fuente) {
  const chunks = [];
  // Las preguntas son h5 dentro del contenido principal; la respuesta es el
  // texto que sigue hasta la próxima pregunta. (Selector a ajustar tras inspección real.)
  $('h5').each((_, el) => {
    const pregunta = $(el).text().trim();
    // Recolectar el contenido siguiente hasta el próximo h5/h4/h3
    let respuesta = '';
    let sig = $(el).next();
    while (sig.length && !['H5', 'H4', 'H3'].includes(sig.prop('tagName'))) {
      respuesta += ' ' + sig.text().trim();
      sig = sig.next();
    }
    respuesta = respuesta.trim();
    if (pregunta && respuesta) {
      chunks.push({
        content: `${pregunta}\n${respuesta}`,
        tema: null,          // se asigna en la curación de metadata
        articulos: [],       // se extraen/curan después
        fuente_url: fuente.url,
        fuente_titulo: fuente.titulo,
        fuente_fecha: fuente.actualizado || null
      });
    }
  });
  return chunks;
}

// Parsea el texto de la Ley 24.240 a un chunk por artículo.
function parsearLey($, fuente) {
  const chunks = [];
  const texto = $('body').text();
  // Separar por "ARTICULO N" / "Artículo N". (Regex a refinar tras inspección real.)
  const partes = texto.split(/(?=ART[IÍ]CULO\s+\d+)/i);
  for (const parte of partes) {
    const limpio = parte.trim();
    const m = limpio.match(/ART[IÍ]CULO\s+(\d+)/i);
    if (m && limpio.length > 40) {
      chunks.push({
        content: limpio.slice(0, 2000),
        tema: 'norma_completa',
        articulos: [`Ley 24.240 Art. ${m[1]}`],
        fuente_url: fuente.url,
        fuente_titulo: fuente.titulo,
        fuente_fecha: fuente.actualizado || null
      });
    }
  }
  return chunks;
}

export async function obtenerChunks() {
  const inventario = JSON.parse(await readFile(INVENTARIO, 'utf-8'));
  const todos = [];

  for (const fuente of inventario.fuentes) {
    console.log(`[fetch] ${fuente.titulo}`);
    const res = await fetch(fuente.url);
    if (!res.ok) throw new Error(`Fetch falló (${res.status}) para ${fuente.url}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const chunks = fuente.id === 'ley-24240'
      ? parsearLey($, fuente)
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

  console.log(`[fetch] Total: ${todos.length} chunks de ${inventario.fuentes.length} fuentes.`);
  return todos;
}
