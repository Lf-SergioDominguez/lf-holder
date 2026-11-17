---
description: Sube el esfuerzo de este turno y fija el método multiagente para tareas de días. No por defecto.
argument-hint: "[tarea grande]"
disable-model-invocation: true
effort: xhigh
---

Tarea grande: **$ARGUMENTS**

Este comando sube el esfuerzo **de este turno** (`effort: xhigh`) y fija el método de abajo para el resto de la tarea; el coste total crece con los agentes. Úsalo si la tarea es de días y el presupuesto no es el problema; para una decisión difícil puntual basta escribir `ultrathink`, o `/effort high` para subirlo en toda la sesión.

## Método

1. **Un `lf:planner` (Opus) primero.** Produce el plan por capas y los hitos. Nada se implementa hasta que exista.
2. **Un `lf:executor` (Sonnet) por hito, en serie.** Varios ejecutores en paralelo sobre el mismo árbol se pisan. Cada hito cierra con checkpoint de ≤5 líneas y `lf:reviewer`.
3. **Subagentes baratos para el ruido.** `lf:verbose-runner` (Haiku) para tests, builds y logs; `Explore` para búsquedas amplias.
4. **Nada de agent teams.** Cada miembro mantiene contexto propio y cuesta en torno a 7× una sesión normal (estimación no medida aquí). Si hace falta equipo: pequeño, de vida corta, cerrado al terminar.
5. **Cierre de sesión antes que compactación.** Al 75–80 % de contexto: `/lf:handoff` y `/clear`. `/compact` solo como último recurso y con instrucciones.

## Entrega

En cada checkpoint: hito cerrado o bloqueado, ficheros tocados, comando de verificación y siguiente hito.
