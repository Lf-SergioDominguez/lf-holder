---
description: Planifica con Opus y ejecuta con Sonnet — atajo de una sola invocación.
argument-hint: "[tarea]"
model: opus
effort: xhigh
---

Tarea: **$ARGUMENTS**

Ejecuta el ciclo completo **Opus planifica → Sonnet ejecuta**, sin cambiar de modelo a mano. Promesa a cambio: la caché de prompts se invalida al cambiar de modelo dentro de la sesión. Si el coste de caché importa, usa el flujo de dos sesiones que se indica al final.

## Fase 1 — Plan (Opus, esta sesión)

1. Lanza el subagente `lf:planner` con la tarea. Devuelve su plan tal cual, sin reescribirlo ni añadir pasos.
2. Muestra el plan en ≤20 líneas (Objetivo, Decisiones, Contrato, Pasos, Riesgos, Hitos) y para.

```
Plan listo. Cambiar a Sonnet y ejecutar:
  /model claude-sonnet-5-5
  /lf:opusplan --go
```

## Fase 2 — Ejecución (tras el cambio a Sonnet)

Si esta invocación trae `--go` (o el usuario responde "ok"), relanza `lf:executor` con el plan de la Fase 1 y ejecuta **un solo hito**. El agente ejecutor no vuelve a planificar.

## Flujo recomendado (dos sesiones, caché intacta)

Para una tarea L de verdad, lo barato no es este atajo:

1. Sesión Opus: `/model claude-opus-5-5` → `/lf:l <tarea>` o `lf:planner` → plan en `.planning/ARCHITECTURE.md`.
2. `/lf:handoff` y `/clear`.
3. Sesión Sonnet: `/model claude-sonnet-5-5` → `/lf:l --resume` o el agente `lf:executor` con ese plan.

Ningún paso daña el árbol: `planner` no escribe, `executor` no commitea.
