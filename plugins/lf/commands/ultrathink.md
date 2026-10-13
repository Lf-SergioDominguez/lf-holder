---
description: Razona a fondo durante un único turno, sin subir el esfuerzo ni el modelo de toda la sesión.
argument-hint: "[pregunta o decisión difícil]"
effort: xhigh
---

Pregunta: **$ARGUMENTS**

Esta es una pregunta difícil de un turno. No cambies el modelo de la sesión ni durables: no abras subagentes, no lances `lf:planner`, no escribas ficheros, no propongas plan. Escribe código.

Método, en este orden y sin saltártelo:

1. **Reformula** el problema en una frase, y di qué se está suponiendo sin comprobar.
2. **Enumera las opciones reales** (≥3, incluidas la que no te gusta) con su coste y su riesgo.
3. **Elimina** las que se rompen por un hecho del código. Cita `fichero:línea` para cada eliminación.
4. **Elige una** y di en una línea por qué descartas la mejor alternativa.
5. **Verifica**: nombra el comando o la lectura que confirmaría la respuesta. Si no puedes, dilo.

Salida: ≤25 líneas. La respuesta va primero, el razonamiento detrás. Sin preámbulo, sin repetir la pregunta, sin resumen final de lo ya dicho. Si la respuesta es «no lo sé», dilo en la primera línea y di qué dato falta.
