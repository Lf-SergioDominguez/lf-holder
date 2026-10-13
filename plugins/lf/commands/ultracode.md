---
description: Cambia toda la sesión a esfuerzo máximo y activa flujo multiagente. No lo uses por defecto.
argument-hint: "[tarea grande]"
effort: xhigh
---

Sesión de máximo rendimiento: **$ARGUMENTS**

Esto cambia el coste de la sesión completa, no un turno. Úsalo cuando la tarea sea de días y el presupuesto no sea el problema; para una decisión difícil puntual, `/lf:ultrathink` es bastante más barato.

## Cómo trabajar en esta sesión

1. **Un `lf:planner` (Opus) primero.** Produce el plan por capas y los hitos. Nada se implementa hasta que el plan exista.
2. **Un `lf:executor` (Sonnet) por hito, en serie.** Un ejecutor a la vez: varios ejecutores en paralelo sobre el mismo árbol se pisan. Cada hito cierra con checkpoint de ≤5 líneas y `lf:reviewer`.
3. **Subagentes baratos para el ruido.** `lf:verbose-runner` (Haiku) para tests, builds y logs; `Explore` para búsquedas amplias. Devuelven un resumen: su trabajo no ensucia la conversación principal.
4. **Nada de agent teams.** Cada miembro mantiene contexto propio y, según estimaciones, cuesta en torno a 7× una sesión normal; además acortan la ventana de trabajo de horas a minutos. Si aun así necesitas equipo, es pequeño, de vida corta, y se cierra al terminar.
5. **Cierre de sesión antes que compactación.** Al 75–80 % de contexto: `/lf:handoff` y `/clear`. `/compact` solo como último recurso y con instrucciones explícitas de qué decisiones conservar.

## Entrega

En cada checkpoint: hito cerrado o bloqueado, ficheros tocados, comando de verificación y siguiente hito. Sin Journals de proceso y sin repetir lo ya dicho.
