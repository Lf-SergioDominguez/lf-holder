---
description: Opus planifica y Sonnet ejecuta en una sola sesión (invalida la caché al cambiar de modelo).
argument-hint: "[tarea]"
disable-model-invocation: true
model: opus
---

Tarea: **$ARGUMENTS**

Ciclo **Opus planifica → Sonnet ejecuta**. Cambiar de modelo dentro de la sesión invalida la caché de prompts; si el coste importa, usa el flujo de dos sesiones del final.

## Fase 1 — Plan (Opus, esta sesión)

1. Lanza el subagente `lf:planner` con la tarea. Devuelve su plan tal cual, sin reescribirlo ni añadir pasos.
2. Muestra el plan en ≤20 líneas (Objetivo, Decisiones, Contrato, Pasos, Riesgos, Hitos) y para:

```
Plan listo. Cambiar a Sonnet y ejecutar:
  /model claude-sonnet-5-5
  /lf:opusplan --go
```

## Fase 2 — Ejecución (tras el cambio a Sonnet)

Si la invocación trae `--go` (o el usuario responde «ok»), lanza `lf:executor` con el plan de la Fase 1 y ejecuta **un solo hito**. El ejecutor no vuelve a planificar.

## Flujo recomendado para una L real (dos sesiones, caché intacta)

1. Sesión Opus: `/model claude-opus-5-5` → `/lf:l <tarea>` o `lf:planner` → plan en `.planning/ARCHITECTURE.md`.
2. `/lf:handoff` y `/clear`.
3. Sesión Sonnet: `/model claude-sonnet-5-5` → `/lf:l --resume` o `lf:executor` con ese plan.

`planner` no escribe; `executor` no commitea.
