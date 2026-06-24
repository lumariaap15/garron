// ingesta/embeddings.test.js
// Prueba el chunker parent→hijos. No carga el modelo (solo lógica de partición).
// Correr:  node --test ingesta/*.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividirEnHijos } from './embeddings.js';

test('texto corto (≤80 palabras) → un solo hijo igual al texto', () => {
  const t = '¿Qué es la garantía? Es un certificado escrito que te dan al comprar una cosa nueva.';
  const hijos = dividirEnHijos(t);
  assert.equal(hijos.length, 1);
  assert.equal(hijos[0], t);
});

test('texto largo → varios hijos, cada uno entra en la ventana del modelo', () => {
  const largo = Array.from({ length: 18 }, (_, i) =>
    `Esta es la oración número ${i + 1} con varias palabras para llenar la ventana de contexto del modelo de manera realista.`
  ).join(' ');
  const hijos = dividirEnHijos(largo);
  assert.ok(hijos.length > 1, `esperaba varios hijos, hubo ${hijos.length}`);
  for (const h of hijos) {
    assert.ok(h.trim().length > 0, 'hijo vacío');
    assert.ok(h.split(/\s+/).length <= 110, `hijo demasiado largo: ${h.split(/\s+/).length} palabras`);
  }
});

test('hay solape: la última oración de un hijo abre el siguiente', () => {
  const largo = Array.from({ length: 12 }, (_, i) =>
    `Oración ${i + 1} con suficientes palabras para ir llenando la ventana del modelo de embeddings paso a paso.`
  ).join(' ');
  const hijos = dividirEnHijos(largo);
  const ultimaDelPrimero = (hijos[0].match(/[^.?!]+[.?!]*/g) || []).slice(-1)[0].trim();
  assert.ok(
    hijos[1].trim().startsWith(ultimaDelPrimero.slice(0, 25)),
    'el segundo hijo no arranca con la última oración del primero (sin solape)'
  );
});
