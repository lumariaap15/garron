# Golden set — consultas de prueba

Set de consultas reales para diseñar y evaluar el sistema (recuperación + calidad de
cita + derivación correcta). Organizado por los 4 tipos de consulta identificados.
Sirve para calibrar el umbral de evidencia y los pesos de la búsqueda híbrida.

## Tipo 1 — ¿Tengo derecho? (situación → derecho → artículo)

| Consulta | Esperado | Artículo clave |
|---|---|---|
| "Compré una heladera y vino fallada, ¿qué puedo hacer?" | Garantía: reparación, cambio o devolución | Ley 24.240 Art. 11 |
| "Compré por internet y me arrepentí, ¿puedo devolverlo?" | Derecho de arrepentimiento, 10 días | Ley 24.240 Art. 34 / CCyC 1110 |
| "Me cobraron más caro que el precio de la vidriera" | Vale el precio exhibido | Ley 24.240 Art. 8 |
| "¿Cuánto dura la garantía de un producto usado?" | 3 meses usados / 6 nuevos | Ley 24.240 Art. 11 |

## Tipo 2 — ¿Cómo reclamo? (procedimiento)

| Consulta | Esperado |
|---|---|
| "¿Dónde reclamo si una empresa no me cumple?" | Ventanilla Única Federal + qué datos llevar |
| "¿Cuánto tiempo tengo para reclamar?" | Plazo de 3 años desde el incumplimiento |
| "¿Cómo doy de baja un servicio por internet?" | Botón de baja, código en 24hs |

## Tipo 3 — ¿Aplica a mi caso? (alcance / excepciones → DERIVAR)

| Consulta | Esperado |
|---|---|
| "Me cancelaron un vuelo, ¿reclamo en Defensa del Consumidor?" | DERIVAR → ANAC |
| "Mi abogado no hizo bien su trabajo" | DERIVAR → Colegio de Abogados |
| "Me facturan de más la luz" | SÍ aplica → consumo promedio, conceptos indebidos |

## Tipo 4 — Caso narrado complejo

| Consulta | Esperado |
|---|---|
| "Compré un celular hace 2 meses, dejó de andar, lo llevé al service y no me lo arreglan hace semanas" | Garantía vigente (no corre el plazo durante reparación) + opciones + cómo reclamar |
| "Me suscribí a un gimnasio, lo quiero dar de baja y me piden pagar un mes más" | No pueden cobrar preaviso ni mes adelantado + cómo dar de baja |

## Casos de borde (deben dar "sin evidencia" o derivar, NO inventar)

| Consulta | Esperado |
|---|---|
| "¿Puedo importar un auto sin pagar impuestos?" | sin_evidencia (fuera del corpus) |
| "¿Cuál es la capital de Francia?" | sin_evidencia (fuera de dominio) |
