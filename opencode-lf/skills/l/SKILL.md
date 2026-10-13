---
name: l
description: Flujo L para features o módulos grandes — entrevista breve, contrato de arquitectura y ejecución por hitos.
---

Tarea L: **$ARGUMENTS**

Objetivo: dejar la arquitectura atada con el mínimo de preguntas y abrir los hitos de uno en uno, con checkpoints solo al cerrar cada hito. Planifica con el modelo de planificación en las fases 1–3; la ejecución por hitos va **siempre** con el modelo estándar. Solo modelos gratuitos del catálogo de OpenCode.

## Fase 1 — Contexto (sin preguntas)

- Lee el `AGENTS.md` del proyecto, `composer.json` y/o `package.json`, y la estructura de `src/` (o `src/components`, `wp-content/plugins/<x>`): ≤10 lecturas, Grep/Glob antes que Read.
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

## Fase 4 — Ejecución por hitos

La ejecución no se delega a ninguna herramienta externa: los hitos se abren de uno en uno, con el mismo criterio que el flujo M.

1. Escribe `.planning/STATE.md` con los hitos del contrato, su estado (`pendiente` / `hecho` / `bloqueado`) y el siguiente hito. Sobrescribe el fichero, no lo acumules con fecha.
2. Si no existe `.planning/config.json`, copia la plantilla del arnés: busca `planning-config.json` con Glob `**/project-templates/planning-config.json` y cópiala a `.planning/config.json`.
3. Si no existe `.planning/PROJECT.md`, créalo a partir de ARCHITECTURE.md: contexto y decisiones ya están, no repitas la entrevista.
4. Por cada hito, en orden:
   - `@planner` (solo lectura) para el plan del hito, **únicamente** si tiene zonas grises no cubiertas por ARCHITECTURE.md.
   - `@executor` para implementar **un solo hito**, con el modelo estándar.
   - `@reviewer` sobre el diff del hito.
   - **Checkpoint** de 5 líneas: hecho / cómo se verificó / desvíos respecto al contrato / siguiente hito / ¿continuar? Solo aquí se espera al usuario.
5. No pidas confirmación intermedia salvo bloqueo real (fallo de test no resoluble, decisión que contradice el contrato).

## Fase 5 — Cierre

- `@reviewer` sobre el diff del último hito.
- Resumen final: hitos cerrados, cómo probar, deuda pendiente.
- No compactes: escribe `handoff.md` con `/handoff` y abre sesión nueva (`/new`). Si por fuerza hay que compactar, resume primero decisiones, enfoques descartados y ficheros modificados.
