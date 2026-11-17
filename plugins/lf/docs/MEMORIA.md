# Memoria: handoff, notas y consolidación

Qué se guarda y dónde, para que la sesión siguiente retome sin releer nada.

**Flujo:** transcripts → notas de memoria → `/lf:dream` → índice (`MEMORY.md`, `USER.md`) → contexto inyectado en la sesión siguiente.

## Capas y presupuestos

| Capa | Dónde | Presupuesto | Quién la escribe |
| --- | --- | --- | --- |
| Transcripts | `~/.claude/projects/<proyecto>/*.jsonl` (nativo) | — | Claude Code |
| Notas de proyecto | `~/.claude/projects/<proyecto>/memory/*.md`, un hecho por fichero, frontmatter + `[[enlaces]]` | ≤30 líneas por nota | la sesión y `/lf:dream` |
| Índice del proyecto | `memory/MEMORY.md` (se inyecta al abrir sesión) | **≤60 líneas** | `/lf:dream` |
| Memoria de usuario | `~/.claude/lf/memory/USER.md` + `notes/`, importada con `@` desde `~/.claude/CLAUDE.md` | **≤40 líneas** | `/lf:dream` |
| Estado de la tarea | `handoff.md` en la raíz del repo | <1 página | `/lf:handoff` (sobrescribe) |
| Pendientes que sobreviven a la tarea | `to-do.md` en la raíz del repo | <1 página | `/lf:handoff`, solo si hace falta |

Plantillas: `templates/handoff.md` y `templates/todo.md` del plugin. `install.sh` crea `USER.md` si no existe y añade el `@import` al `CLAUDE.md` global; nunca sobrescribe `USER.md`.

## Los cuatro principios

1. **Predictiva.** Una nota dice lo que la próxima sesión necesitará, no lo que pasó.
2. **Prominencia.** Lo que se hace aquí a menudo va arriba: la primera sección de `MEMORY.md` es «Lo que se hace aquí habitualmente» (tareas, comandos de verificación, trampas).
3. **Inyección pequeña.** Se inyecta el índice, no las notas; los presupuestos son duros. Lo que no cabe se archiva (`memory/archive/`, fuera del índice).
4. **Búsqueda + estructura.** Notas atómicas con enlaces `[[ ]]`: se encuentran con `grep` y se leen solo cuando hacen falta.

## Reglas de handoff y notas

- **Un hecho por nota.** Nada de documentos de análisis no pedidos.
- **No duplicar lo recuperable** en `git log`, código o el gestor de tareas.
- **Una sola fuente de verdad:** se sobrescribe, no se acumula con fecha. Fechas absolutas.
- **Próximo paso concreto** (`fichero:línea` + qué hacer + cómo se comprueba). Los enfoques descartados se anotan: es lo primero que una compactación perdería.
- **Lo durable va a memoria; el handoff solo lleva estado de tarea.** Una corrección o preferencia que seguirá valiendo se guarda como nota (`/lf:handoff` lo recuerda en su paso 5).
- El handoff es la primera instrucción de la sesión siguiente: tras `/lf:handoff`, `/clear` y sesión nueva.

## `/lf:dream` (consolidación manual)

No es automática: una consolidación sin que nadie la pida gasta tokens y puede fijar como hecho algo que el usuario descartó (ADR 0018).

1. `scripts/dream-digest.mjs` (sin tokens) resume las sesiones posteriores a la última consolidación: peticiones, correcciones e interrupciones, permisos denegados, ficheros editados y cierre de cada sesión. El modelo lee el digest, nunca el JSONL.
2. La skill (Sonnet, `context: fork`) guarda una única copia previa (`memory/.prev.tgz`) y aplica, en orden: **corregir** (contrastar notas con código y digest), **estructurar**, **promover** (lo que reaparece en ≥2 sesiones sube; lo universal va a `USER.md`; lo no usado baja a `archive/`) y **enfocar**.
3. Cierra con `+N / ~N / −N notas` y guarda la fecha en `memory/.dream-state.json`.

Para deshacerla: extraer `memory/.prev.tgz` sobre `memory/`.

## Avisos y compactación (hooks)

- `SessionStart` avisa en una línea si existe `handoff.md` («léelo primero», con su fecha) y si hay **≥5 sesiones, o ≥7 días con alguna**, sin consolidar: `/lf:dream`.
- `PreCompact` (`hooks/precompact.sh`) no evita compactar —la política sigue siendo `/lf:handoff` + `/clear`—, pero añade a las instrucciones del resumen lo que se perdería primero: decisiones y enfoques descartados, ficheros modificados, bloqueos y próximo paso.
