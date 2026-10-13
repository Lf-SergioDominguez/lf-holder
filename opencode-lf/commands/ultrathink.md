---
description: Razona a fondo durante un único turno, sin cambiar el modelo de la sesión.
agent: plan
---

Pregunta: **$ARGUMENTS**

Esta es una pregunta difícil de un turno. No cambies el modelo de la sesión, no abras subagentes, no lances `@planner`, no escribas ficheros, no propongas plan. Escribe código.

Método, en este orden y sin saltártelo:

1. **Reformula** el problema en una frase y di qué se está suponiendo sin comprobar.
2. **Enumera las opciones reales** (≥3, incluida la que no te gusta) con su coste y su riesgo.
3. **Elimina** las que se rompen por un hecho del código. Cita `fichero:línea` para cada eliminación.
4. **Elige una** y di en una línea por qué descartas la mejor alternativa.
5. **Verifica**: nombra el comando o la lectura que confirmaría la respuesta. Si no puedes, dilo.

Salida: ≤25 líneas. La respuesta va primero, el razonamiento detrás. Sin preámbulo, sin repetir la pregunta, sin resumen final de lo ya dicho. Si la respuesta es «no lo sé», dilo en la primera línea y di qué dato falta.
