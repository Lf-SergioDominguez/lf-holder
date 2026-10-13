---
description: Cambia toda la sesión a esfuerzo máximo y activa flujo multiagente. No lo uses por defecto.
agent: build
model: opencode/planificacion:latest
---

Sesión de máximo rendimiento: **$ARGUMENTS**

Esto cambia el coste de la sesión completa, no un turno. Úsalo cuando la tarea sea de días y el presupuesto no sea el problema; para una decisión difícil puntual, `/ultrathink` es bastante más barato.

## Cómo trabajar en esta sesión

1. **Un `@planner` (modelo de planificación) primero.** Produce el plan por capas y los hitos. Nada se implementa hasta que el plan exista.
2. **Un `@executor` (modelo estándar) por hito, en serie.** Un ejecutor a la vez: varios ejecutores en paralelo sobre el mismo árbol se pisan. Cada hito cierra con checkpoint de ≤5 líneas y `@reviewer`.
3. **Subagentes baratos para el ruido.** `@verbose-runner` (modelo ligero) para tests, builds y logs; `@explore` para búsquedas amplias. Devuelven un resumen: lo que leen no ensucia la conversación principal.
4. **Nada de agent teams.** Cada miembro mantiene contexto propio y, según estimaciones, cuesta en torno a 7× una sesión normal; además acortan la ventana de trabajo de horas a minutos. Si aun así necesitas equipo, es pequeño, de vida corta, y se cierra al terminar.
5. **Cierre de sesión antes que compactación.** Al 75–80 % de contexto: `/handoff` y `/new`. La compactación solo como último recurso.

## Entrega

En cada checkpoint: hito cerrado o bloqueado, ficheros tocados, comando de verificación y siguiente hito. Sin journals de proceso y sin repetir lo ya dicho.
