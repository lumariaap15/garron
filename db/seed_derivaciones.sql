-- ============================================================
-- Garrón — Derivaciones iniciales (casos fuera de alcance)
-- ============================================================
-- Estos casos NO se resuelven por Defensa del Consumidor.
-- Garrón los reconoce y deriva al organismo correcto, sin llamar al LLM.
-- Ampliar esta tabla a medida que se detecten más casos límite.
-- ============================================================

insert into derivaciones (patron, mensaje, organismo, url) values
(
  'vuelo',
  'Los reclamos por demora, cancelación de vuelos, daños a personas o cosas, y pérdida o sustracción de equipaje NO se tramitan ante Defensa del Consumidor. Tenés que reclamar ante la autoridad aeronáutica.',
  'ANAC — Administración Nacional de Aviación Civil',
  'https://www.argentina.gob.ar/anac'
),
(
  'aerolínea',
  'Los reclamos contra compañías aéreas por el servicio de transporte aéreo NO se tramitan ante Defensa del Consumidor.',
  'ANAC — Administración Nacional de Aviación Civil',
  'https://www.argentina.gob.ar/anac'
),
(
  'profesional matriculado',
  'Los reclamos por servicios de profesionales con matrícula habilitante (abogados, médicos, arquitectos, ingenieros, etc.) NO se tramitan ante Defensa del Consumidor, salvo lo referido a la publicidad de sus servicios. Tenés que dirigirte al colegio o consejo profesional correspondiente.',
  'Colegio o Consejo Profesional respectivo',
  null
),
(
  'abogado',
  'Los reclamos por servicios de abogados (salvo su publicidad) se dirigen al Colegio de Abogados correspondiente, no a Defensa del Consumidor.',
  'Colegio de Abogados',
  null
),
(
  'médico',
  'Los reclamos por la atención de un profesional médico se dirigen al colegio o consejo médico correspondiente. Las prácticas y productos de salud comprados sí pueden estar amparados por la ley de consumo.',
  'Colegio Médico / Superintendencia de Servicios de Salud',
  null
);
