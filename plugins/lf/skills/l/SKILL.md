---
name: l
description: Flujo L para features o módulos grandes — entrevista breve, contrato de arquitectura y ejecución por hitos con GSD.
argument-hint: "[feature o proyecto grande]"
effort: high
allowed-tools: Read Grep Glob Write Edit AskUserQuestion Skill Agent Bash(git *) Bash(ls *) Bash(rg *) Bash(cat *) Bash(mkdir *) Bash(bash *gsd-lean.sh*)
---

Tarea L: **$ARGUMENTS**

Objetivo: dejar la arquitectura atada con el mínimo de preguntas y delegar la ejecución en GSD por hitos, con checkpoints solo al cerrar cada hito. Opus (`/model claude-opus-5-5`) solo en las fases 1–3, para ARCHITECTURE.md; `gsd-plan-phase` y `gsd-execute-phase` van **siempre** con Sonnet, una orden por sesión. Fable está prohibido.

## Fase 1 — Contexto (sin preguntas)

- Lee el `CLAUDE.md` del proyecto, `composer.json` y/o `package.json`, y la estructura de `src/` (o `src/components`, `wp-content/plugins/<x>`): ≤10 lecturas, Grep/Glob antes que Read.
- Si existe `.planning/` con `STATE.md`/`ROADMAP.md`: lee solo su estado (fase actual, planes pendientes) y **salta a la Fase 4** (retomar), sin lanzar ninguna orden GSD.

## Fase 2 — Entrevista (una sola tanda, ≤5 preguntas)

Usa `AskUserQuestion` una única vez, con como máximo 5 preguntas, solo sobre lo que no se deduce del código:

1. Alcance y no-alcance (qué queda explícitamente fuera).
2. Modelo de datos: entidades nuevas, relaciones, campos obligatorios.
3. Contratos externos: API/rutas, eventos, props de componentes, integraciones.
4. Restricciones: compatibilidad (PHP/Node/navegadores), rendimiento, seguridad, plazos.
5. Criterio de "hecho": qué debe poder hacer el usuario final y cómo se verifica.
   Propón opciones concretas con una recomendada; evita preguntas abiertas.

## Fase 3 — Contrato de arquitectura

Escribe `.planning/ARCHITECTURE.md` (≤80 líneas) con:

- Módulos/bounded contexts y responsabilidades.
- Entidades y campos (tipo, nulabilidad, índices), migraciones previstas.
- Endpoints/rutas o componentes con props/emits; DTOs; validación.
- Decisiones con la alternativa descartada y el motivo (1 línea cada una).
- **Hitos (3–6)**, cada uno con: entregable, ficheros clave, criterio de verificación (test/comando concreto).
  Presenta el contrato resumido (≤15 líneas) y espera **un solo OK**. Ajusta si el usuario corrige; no reabras la entrevista.

## Fase 4 — Ejecución con GSD: una orden por sesión

Regla de coste: **una orden GSD pesada por sesión, con `/clear` entre medias y en Sonnet**. Encadenar plan → execute → siguiente fase en el mismo contexto lo hace compactar varias veces y relee todo en cada turno; el hook `gsd-one-per-session` bloquea la segunda orden. Esta skill no lanza `gsd-plan-phase` ni `gsd-execute-phase`: deja escrita la siguiente orden y para.

1. `bash "${CLAUDE_PLUGIN_ROOT}/scripts/gsd-lean.sh"`: crea `.planning/config.json` desde la plantilla o ajusta el existente a modo barato (planner y executor en Sonnet, sin plan-checker ni verifier, sin `auto_advance`, `context_guard_mode: auto`). Si cambia algo, enséñalo en una línea; si falla (config ilegible), para y enseña el error: no sigas con GSD en modo caro.
2. Si no existe `.planning/PROJECT.md`: `Skill(gsd-new-project)` indicando que ARCHITECTURE.md ya contiene el contexto, las decisiones y los hitos (que no repita la entrevista ni investigue). Es la única orden GSD de esta sesión.
3. Entrega el plan de sesiones del siguiente hito y para. Cada línea es una sesión nueva (`/clear` y `/model claude-sonnet-5-5` antes de cada una):
   - `/gsd-discuss-phase N`, **solo** si el hito tiene zonas grises no cubiertas por ARCHITECTURE.md.
   - `/gsd-plan-phase N`.
   - `/gsd-execute-phase N`. Si el plan sale con más de 4 PLAN.md o con varias oleadas, una oleada por sesión: `/gsd-execute-phase N --wave 1`, `/clear`, `--wave 2`…
4. Si una sesión llega al 60 % de contexto sin terminar, deja que acabe el plan en curso, `/clear` y relanza la misma orden: GSD retoma desde los SUMMARY.md ya escritos.
5. Al cerrar cada hito, checkpoint de 5 líneas en una sesión nueva con `/lf:l` (retoma desde `STATE.md`): hecho / cómo se verificó / desvíos respecto al contrato / siguiente hito / siguiente orden exacta.

## Fase 5 — Cierre

- `Agent(lf:reviewer)` sobre el diff del último hito.
- Resumen final: hitos cerrados, cómo probar, deuda pendiente.
- No compactes: `/lf:handoff` y luego `/clear` con `/model claude-sonnet-5-5`. Si por fuerza hay que compactar, resume antes decisiones, enfoques descartados y ficheros modificados.
