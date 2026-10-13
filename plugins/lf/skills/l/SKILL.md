---
name: l
description: Flujo L para features o módulos grandes — entrevista breve, contrato de arquitectura y ejecución por hitos con GSD.
argument-hint: "[feature o proyecto grande]"
effort: high
allowed-tools: Read Grep Glob Write Edit AskUserQuestion Skill Agent Bash(git *) Bash(ls *) Bash(rg *) Bash(cat *) Bash(mkdir *) Bash(cp *)
---

Tarea L: **$ARGUMENTS**

Objetivo: dejar la arquitectura atada con el mínimo de preguntas y delegar la ejecución en GSD por hitos, con checkpoints solo al cerrar cada hito. Planifica con Opus (`/model claude-opus-5-5`) en las fases 1–3; la ejecución por hitos va **siempre** con Sonnet. Fable está prohibido.

## Fase 1 — Contexto (sin preguntas)

- Lee el `CLAUDE.md` del proyecto, `composer.json` y/o `package.json`, y la estructura de `src/` (o `src/components`, `wp-content/plugins/<x>`): ≤10 lecturas, Grep/Glob antes que Read.
- Si existe `.planning/` con `STATE.md`/`ROADMAP.md`: léelos y **salta a la Fase 4** (retomar).

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

## Fase 4 — Ejecución con GSD

1. Si no existe `.planning/config.json`, copia la plantilla del plugin: `cp "${CLAUDE_PLUGIN_ROOT}/../../project-templates/planning-config.json" .planning/config.json` (si la ruta no existe, usa `/gsd-config` y desactiva worktrees, research y verifier).
2. Si no existe `.planning/PROJECT.md`: `Skill(gsd-new-project)` indicando que ARCHITECTURE.md ya contiene el contexto y las decisiones (que no repita la entrevista).
3. Por cada hito, en orden:
   - `Skill(gsd-discuss-phase)` **solo** si el hito tiene zonas grises no cubiertas por ARCHITECTURE.md.
   - `Skill(gsd-plan-phase)`.
   - `Skill(gsd-execute-phase)`.
   - **Checkpoint** de 5 líneas: hecho / cómo se verificó / desvíos respecto al contrato / siguiente hito / ¿continuar? Solo aquí se espera al usuario.
4. No pidas confirmación intermedia salvo bloqueo real (fallo de test no resoluble, decisión que contradice el contrato).

## Fase 5 — Cierre

- `Agent(lf:reviewer)` sobre el diff del último hito.
- Resumen final: hitos cerrados, cómo probar, deuda pendiente.
- No compactes: `/lf:handoff` y luego `/clear` con `/model claude-sonnet-5-5`. Si por fuerza hay que compactar, resume antes decisiones, enfoques descartados y ficheros modificados.
