# web/ — Frontend (Fase 5)

Aún no implementado. Acá va el frontend Next.js. Notas de diseño para cuando se construya:

## Principio rector

La UI tiene que comunicar en 3 segundos que **esto sabe del problema del usuario**,
para que la primera reacción NO sea "¿esto no lo hace ChatGPT?".

## Decisiones de UI (del posicionamiento)

1. **Inicio guiado por categorías, no una caja de chat vacía.**
   Botones con los problemas reales más frecuentes:
   - "Compré algo fallado"
   - "Me arrepentí de una compra online"
   - "Me facturan de más"
   - "Quiero dar de baja un servicio"
   Una caja vacía invita a la comparación con un chat genérico; las categorías dicen
   "esto entiende TU situación".

2. **Respuesta en formato ficha, no párrafo suelto:**
   - Bloque "Qué te corresponde"
   - Bloque "Fundamento legal" (artículo + link oficial, destacado)
   - Bloque "Cómo reclamar" (pasos + botón a la Ventanilla Única)

3. **Badge de fuente oficial** visible: "Basado en la Ley 24.240 — fuente: argentina.gob.ar".

4. **Tarjeta de derivación** clara cuando el caso queda fuera de alcance (ej. vuelo → ANAC).

5. **(Opcional) Toggle "lenguaje accesible"** para consumidores hipervulnerables.

## Stack sugerido

- Next.js (App Router) en Vercel (free tier)
- Llama a la Edge Function `consulta` vía `fetch`
- Solo usa la `SUPABASE_ANON_KEY` en el cliente (nunca la service key)
