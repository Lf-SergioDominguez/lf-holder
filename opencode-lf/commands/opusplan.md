---
description: Planifica con el modelo de planificación y ejecuta con el estándar — atajo de una sola invocación.
agent: plan
model: opencode/planificacion:latest
---

Tarea: **$ARGUMENTS**

Ejecuta el ciclo completo **planificación → ejecución**, sin cambiar de modelo a mano. A cambio: la caché de prompts se invalida al cambiar de modelo dentro de la sesión. Si el coste de caché importa, usa el flujo de dos sesiones del final.

## Fase 1 — Plan (modelo de planificación)

1. Lanza el subagente `@planner` con la tarea. Devuelve su plan tal cual, sin reescribirlo ni añadir pasos.
2. Muestra el plan en ≤20 líneas (Objetivo, Decisiones, Contrato, Pasos, Riesgos, Hitos) y para.

```
Plan listo. Cambia al modelo estándar (en `/models`, el último `opencode/big-pickle`) y ejecuta:
  /opusplan --go
```

## Fase 2 — Ejecución (tras el cambio al modelo estándar)

Si esta invocación trae `--go` (o el usuario responde "ok"), relanza `@executor` con el plan de la Fase 1 y ejecuta **un solo hito**. El ejecutor no vuelve a planificar.

## Flujo recomendado (dos sesiones, caché intacta)

Para una tarea L de verdad, lo barato no es este atajo:

1. Sesión de planificación: `/models` → el `opencode/muse-spark-1.3-free` más reciente → `@planner` o `/l <tarea>` → plan en `.planning/ARCHITECTURE.md`.
2. `/handoff` y `/new`.
3. Sesión estándar: `/models` → el `opencode/big-pickle` más reciente → `@executor` con ese plan.

Ningún paso daña el árbol: `planner` no escribe, `executor` no comitea.
