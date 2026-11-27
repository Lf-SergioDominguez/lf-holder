---
name: l
description: Flujo L para features o módulos grandes — entrevista breve, contrato de arquitectura y ejecución por hitos, uno por sesión.
argument-hint: "[feature o proyecto grande]"
effort: high
allowed-tools: Read Grep Glob Write Edit AskUserQuestion Skill Agent Bash(git *) Bash(ls *) Bash(rg *) Bash(cat *) Bash(mkdir *)
---

Tarea L: **$ARGUMENTS**

Objetivo: dejar la arquitectura atada con el mínimo de preguntas y ejecutar los hitos de uno en uno, con checkpoints solo al cerrar cada hito. Opus (`/model claude-opus-5-5`) solo en las fases 1–3, para ARCHITECTURE.md; la ejecución de cada hito va **siempre** con Sonnet, un hito por sesión. Fable está prohibido.

## Fase 1 — Contexto (sin preguntas)

- Lee el `CLAUDE.md` del proyecto, `composer.json` y/o `package.json`, y la estructura de `src/` (o `src/components`, `wp-content/plugins/<x>`): ≤10 lecturas, Grep/Glob antes que Read.
- Si existe `.planning/STATE.md`: léelo y **salta a la Fase 4** (retomar).

## Fase 2 — Entrevista (una sola tanda, ≤4 preguntas)

Usa `AskUserQuestion` una única vez, con como máximo 4 preguntas, solo sobre lo que no se deduce del código:

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

## Fase 4 — Ejecución por hitos: uno por sesión

Regla de coste: **un hito por sesión, con `/clear` y `/model claude-sonnet-5-5` entre hitos**. Ejecutar varios en el mismo contexto lo hace compactar y se relee todo en cada turno.

1. Si no existe `.planning/STATE.md`, créalo con los hitos del contrato, su estado (`pendiente` / `hecho` / `bloqueado`) y el siguiente hito. Si existe (retomar), léelo y no lo regeneres: solo se actualiza al cerrar un hito, sobrescribiendo, sin acumular con fecha.
2. Con el siguiente hito pendiente:
   - `Agent(lf:planner)` (Opus, solo lectura) para el plan del hito, **únicamente** si tiene zonas grises no cubiertas por ARCHITECTURE.md.
   - `Agent(lf:executor)` con `model: sonnet` para implementar **solo ese hito**.
   - `Agent(lf:reviewer)` sobre el diff del hito.
   - Actualiza `STATE.md` y da el **checkpoint** de 5 líneas: hecho / cómo se verificó / desvíos respecto al contrato / siguiente hito / orden para la próxima sesión (`/clear`, `/model claude-sonnet-5-5` y `/lf:l`, que retoma desde `STATE.md`).
3. Para ahí: no encadenes el siguiente hito en la misma sesión. No pidas confirmación intermedia salvo bloqueo real (fallo de test no resoluble, decisión que contradice el contrato).
4. Si la sesión llega al 60 % de contexto sin terminar el hito, `/lf:handoff` y `/clear`.

## Fase 5 — Cierre (tras el último hito)

- El `lf:reviewer` de la Fase 4 ya cubre el último hito: no lo repitas.
- Resumen final: hitos cerrados, cómo probar, deuda pendiente.
- No compactes: `/lf:handoff` y luego `/clear` con `/model claude-sonnet-5-5`. Si por fuerza hay que compactar, resume antes decisiones, enfoques descartados y ficheros modificados.
