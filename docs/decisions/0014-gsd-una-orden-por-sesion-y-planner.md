# 0014 — GSD: una orden por sesión y planner en Sonnet

Fecha: 2026-11-05

Decisión:
1. **Una orden GSD pesada por sesión**, impuesta por el hook `gsd-one-per-session.sh`. Entre `discuss`, `plan` y `execute` (y entre oleadas de una fase grande) va un `/clear`.
2. **Plantilla barata**: `model_profile: budget`, sin plan-checker ni verifier, `auto_advance: false` y `context_guard_mode: auto`. `gsd-lean.sh` la impone en proyectos existentes, pero solo en las claves de coste.
3. **Opus solo para `ARCHITECTURE.md`** (fases 1–3 de `lf:l`). El desglose por fase lo hace `gsd-planner` en Sonnet, sobre un contrato que ya está aprobado.
Motivo: en uso real, dos proyectos L simultáneos consumieron en dos días la mitad de una cuota mensual. Las sesiones caras tenían entre 5 y 10 turnos de subagente por cada turno propio, y Opus triplicaba el coste diario de Sonnet. Dos causas: con `auto_advance: true`, `plan-phase` lanza `execute-phase --auto` en el mismo contexto, y `plan_check` mantiene a `gsd-planner` en Opus durante hasta 3 iteraciones con el checker.
Alternativa descartada: desinstalar GSD (sigue siendo útil para el seguimiento por hitos y los commits atómicos) y bajar solo el modelo sin cortar el encadenamiento, porque el coste lo dominan las relecturas de caché de un contexto que no deja de crecer.
Riesgo: planes de fase menos finos sin Opus ni checker. Si un hito sale mal planificado, se replanifica ese hito con `"model_overrides": {"gsd-planner": "opus"}` en su config, no en todos.
