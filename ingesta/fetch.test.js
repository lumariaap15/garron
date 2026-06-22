// ingesta/fetch.test.js
// Prueba el parser de guías contra HTML real guardado como fixture.
// Correr:  node --test ingesta/
//
// Si argentina.gob.ar cambia su HTML, este test falla ANTES de una re-ingesta
// real, en vez de traer 0 chunks en producción.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio/slim';
import { parsearGuia, parsearSeccion, parsearLey, parsearAnexo } from './fetch.js';

const FIXTURE = new URL('./corpus/fixtures/ls-defensa-consumidor.html', import.meta.url);
const fuente = {
  url: 'https://www.argentina.gob.ar/justicia/derechofacil/leysimple/defensa-del-consumidor',
  titulo: 'Ley Simple: Defensa del consumidor',
  actualizado: '2026-06-19'
};

test('extrae múltiples pares pregunta-respuesta', async () => {
  const $ = cheerio.load(await readFile(FIXTURE, 'utf-8'));
  const chunks = parsearGuia($, fuente);
  assert.ok(chunks.length >= 20, `esperaba >=20 chunks, hubo ${chunks.length}`);
});

test('cada chunk tiene clave, sección y respuesta no vacía', async () => {
  const $ = cheerio.load(await readFile(FIXTURE, 'utf-8'));
  const chunks = parsearGuia($, fuente);
  for (const c of chunks) {
    assert.ok(c.clave, 'clave vacía');
    assert.ok(c.content.includes('\n'), 'content sin separación pregunta/respuesta');
    const respuesta = c.content.split('\n')[1];
    assert.ok(respuesta && respuesta.length > 0, `respuesta vacía para: ${c.clave}`);
  }
});

test('captura la sección temática (h3) de un chunk conocido', async () => {
  const $ = cheerio.load(await readFile(FIXTURE, 'utf-8'));
  const chunks = parsearGuia($, fuente);
  const garantia = chunks.find((c) => c.clave === '¿Qué es la garantía?');
  assert.ok(garantia, 'no encontró la pregunta de garantía');
  assert.equal(garantia.seccion, 'La garantía');
  assert.match(garantia.content, /certificado escrito/);
});

test('no arrastra el footer del sitio (Trámites)', async () => {
  const $ = cheerio.load(await readFile(FIXTURE, 'utf-8'));
  const chunks = parsearGuia($, fuente);
  assert.ok(!chunks.some((c) => c.clave === 'Trámites'), 'se coló el footer');
});

// --- parsearSeccion: páginas con secciones h3 + prosa, sin preguntas h5 ---

const FIXTURE_CLAUSULAS = new URL(
  './corpus/fixtures/ls-clausulas-prohibidas.html', import.meta.url
);
const fuenteClausulas = {
  id: 'ls-clausulas-prohibidas',
  url: 'https://www.argentina.gob.ar/justicia/derechofacil/leysimple/consumo-economia/clausulas-prohibidas-en-los-contratos-de-consumo',
  titulo: 'Ley Simple: Cláusulas prohibidas en los contratos de consumo',
  actualizado: '2026-06-19'
};

const FIXTURE_VENTANILLA = new URL(
  './corpus/fixtures/ls-ventanilla-unica.html', import.meta.url
);
const fuenteVentanilla = {
  id: 'ls-ventanilla-unica',
  url: 'https://www.argentina.gob.ar/justicia/derechofacil/leysimple/ventanilla-unica-federal-de-reclamos-de-defensa-del-consumidor',
  titulo: 'Ley Simple: Ventanilla Federal Única de defensa del consumidor',
  actualizado: '2026-06-19'
};

test('parsearSeccion extrae un chunk por sección temática', async () => {
  const $ = cheerio.load(await readFile(FIXTURE_CLAUSULAS, 'utf-8'));
  const chunks = parsearSeccion($, fuenteClausulas);
  assert.ok(chunks.length >= 3, `esperaba >=3 secciones, hubo ${chunks.length}`);
});

test('parsearSeccion: cada chunk tiene clave única por fuente y cuerpo', async () => {
  const $ = cheerio.load(await readFile(FIXTURE_CLAUSULAS, 'utf-8'));
  const chunks = parsearSeccion($, fuenteClausulas);
  const claves = new Set();
  for (const c of chunks) {
    assert.ok(c.clave.startsWith('ls-clausulas-prohibidas :: '), `clave sin prefijo: ${c.clave}`);
    assert.ok(!claves.has(c.clave), `clave duplicada: ${c.clave}`);
    claves.add(c.clave);
    const cuerpo = c.content.split('\n')[1];
    assert.ok(cuerpo && cuerpo.length > 0, `cuerpo vacío para: ${c.clave}`);
  }
});

test('parsearSeccion captura una sección conocida con su contenido', async () => {
  const $ = cheerio.load(await readFile(FIXTURE_CLAUSULAS, 'utf-8'));
  const chunks = parsearSeccion($, fuenteClausulas);
  const abusivas = chunks.find((c) => c.seccion === 'Cláusulas abusivas');
  assert.ok(abusivas, 'no encontró la sección "Cláusulas abusivas"');
  assert.match(abusivas.content, /proveedor/i);
});

test('parsearSeccion ignora secciones de navegación y la norma completa', async () => {
  const $ = cheerio.load(await readFile(FIXTURE_VENTANILLA, 'utf-8'));
  const chunks = parsearSeccion($, fuenteVentanilla);
  const ruido = ['En esta página', 'Volver al índice', 'Texto completo de la norma'];
  for (const r of ruido) {
    assert.ok(!chunks.some((c) => c.seccion === r), `se coló sección de ruido: ${r}`);
  }
  assert.ok(chunks.some((c) => c.seccion === 'Funciones'), 'falta la sección "Funciones"');
});

// --- parsearLey: texto legal a un chunk por artículo (capa 2) ---

test('parsearLey extrae artículos reales sin referencias fantasma', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/ley-24240.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearLey($, { id: 'ley-24240', cita: 'Ley 24.240', url: 'u', titulo: 't' });
  // La Ley 24.240 tiene ~66 artículos. El regex viejo (insensible) daba 75 por
  // contar referencias "artículo N de..." dentro del texto.
  assert.ok(chunks.length >= 60 && chunks.length <= 70, `esperaba ~66 arts, hubo ${chunks.length}`);
  const nums = chunks.map((c) => c.clave);
  assert.equal(new Set(nums).size, nums.length, 'hay claves de artículo duplicadas');
});

test('parsearLey usa la cita de la fuente, no una hardcodeada', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/ley-25065.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearLey($, { id: 'ley-25065', cita: 'Ley 25.065', url: 'u', titulo: 't' });
  assert.ok(chunks.length > 0, 'no extrajo artículos');
  for (const c of chunks) {
    assert.match(c.clave, /^Ley 25\.065 Art\. \d+$/, `cita inesperada: ${c.clave}`);
    assert.deepEqual(c.articulos, [c.clave]);
    assert.equal(c.tema, 'norma_completa');   // capa 2 ya viene curada
  }
});

// --- parsearAnexo: resolución con anexo enumerado a) b) c) (capa 2) ---

test('parsearAnexo extrae un chunk por cláusula letrada', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/res-53-2003.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearAnexo($, { id: 'res-53-2003', cita: 'Resolución 53/2003', url: 'u', titulo: 't' });
  assert.ok(chunks.length >= 15, `esperaba >=15 cláusulas, hubo ${chunks.length}`);
  // Sin claves duplicadas: el ruido de considerandos/artículos (incisos a)/b) de
  // otros artículos) generaba "Anexo a)" repetida. Debe arrancar en el anexo real.
  const claves = chunks.map((c) => c.clave);
  assert.equal(new Set(claves).size, claves.length, 'hay cláusulas con clave duplicada');
  // La primera cláusula del anexo real es a) "Confieran al proveedor...".
  const a = chunks.find((c) => c.clave === 'Resolución 53/2003 Anexo a)');
  assert.ok(a, 'falta la cláusula a)');
  assert.match(a.content, /^a\) Confieran al proveedor/, `a) arranca mal: ${a.content.slice(0, 40)}`);
  for (const c of chunks) {
    assert.match(c.clave, /^Resolución 53\/2003 Anexo [a-zñ]\)$/, `clave inesperada: ${c.clave}`);
    assert.ok(c.content.length > 40, `cláusula muy corta: ${c.clave}`);
  }
});

test('parsearLey reconoce artículos abreviados "Art. N" (Res. 906/98)', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/res-906-98.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearLey($, { id: 'res-906-98', cita: 'Resolución 906/98', url: 'u', titulo: 't' });
  // Usa "Artículo 1°." y "Art. 2°." en adelante: el regex debe capturar ambos.
  assert.ok(chunks.length >= 8, `esperaba >=8 arts, hubo ${chunks.length}`);
  assert.ok(chunks.some((c) => c.clave === 'Resolución 906/98 Art. 2'), 'no capturó "Art. 2" abreviado');
});

test('parsearLey no contamina el último artículo con footer ni JavaScript', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/res-87-2024.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearLey($, { id: 'res-87-2024', cita: 'Resolución 87/2024', url: 'u', titulo: 't' });
  // El visor de normas mete un <script> y el pie ("Acerca de esta norma") que
  // cheerio.text() pegaba al último artículo. No deben quedar en ningún chunk.
  const basura = /Acerca de esta norma|panelMenu|DOMContentLoaded|addEventListener/;
  for (const c of chunks) {
    assert.ok(!basura.test(c.content), `chunk contaminado con footer/JS: ${c.clave}`);
  }
});

test('parsearAnexo separa múltiples anexos etiquetados (Res. 9/2004)', async () => {
  const $ = cheerio.load(
    await readFile(new URL('./corpus/fixtures/res-9-2004.html', import.meta.url), 'utf-8')
  );
  const chunks = parsearAnexo($, { id: 'res-9-2004', cita: 'Resolución 9/2004', url: 'u', titulo: 't' });
  // Tres anexos sectoriales: I, II, III. Cada cláusula citada con su anexo.
  const anexos = new Set(chunks.map((c) => (c.clave.match(/Anexo ([IVX]+)/) || [])[1]).filter(Boolean));
  assert.ok(anexos.has('I') && anexos.has('II') && anexos.has('III'), `faltan anexos: ${[...anexos]}`);
  assert.ok(
    chunks.some((c) => /^Resolución 9\/2004 Anexo III [a-z]\)$/.test(c.clave)),
    'no capturó cláusulas del Anexo III (servicios financieros)'
  );
});
