---
name: dream
description: Consolida la memoria entre sesiones — corrige, estructura, promueve y enfoca las notas del proyecto y de usuario.
disable-model-invocation: true
context: fork
model: sonnet
effort: medium
allowed-tools: Read Grep Glob Write Edit Bash(node *dream-digest.mjs*) Bash(tar *) Bash(mkdir *) Bash(mv *) Bash(ls *) Bash(wc *) Bash(git log*) Bash(git status*)
---

Consolida la memoria de este proyecto con las sesiones posteriores a la última consolidación. Principios y presupuestos en `~/.claude/lf/docs/MEMORIA.md`.

## Paso 0 — Digest y copia previa

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/dream-digest.mjs"` → JSON con `digest`, `sessions`, `memoryDir` y `generatedAt`. Si `sessions` es 0 **y** la memoria ya existe, ejecuta `node "${CLAUDE_PLUGIN_ROOT}/scripts/dream-digest.mjs" --mark --at <generatedAt>` (si no, el aviso de SessionStart se repetiría), responde «nada que consolidar» y termina.
2. Lee el digest (nunca los `.jsonl`: ni los abras ni los busques con grep).
3. Copia única de seguridad, sobrescribiendo la anterior: `tar -czf <memoryDir>/.prev.tgz -C <memoryDir> --exclude=.prev.tgz .` (si `memoryDir` no existe, `mkdir -p` antes y omite la copia).

## Paso 1 — Cuatro operaciones, en orden

1. **Corregir.** Cada nota que nombre un fichero, flag, versión o decisión se contrasta con el código (`Grep`/`Read` acotado) y con el digest. Lo falso se corrige; lo que ya no existe se borra. Una nota que no puedas comprobar se deja como está.
2. **Estructurar.** Notas atómicas (un hecho por fichero, frontmatter `name`/`description`/`metadata.type`, enlaces `[[nombre]]`). Parte las que mezclen varios hechos. `MEMORY.md` queda por secciones, una línea por nota: `- [Título](fichero.md) — gancho`.
3. **Promover.** Lo que reaparece en ≥2 sesiones del digest sube en `MEMORY.md`. Lo que vale para todos los proyectos (preferencias, estilo, rol) va a `USER.md` en `~/.claude/lf/memory/` (`$CLAUDE_CONFIG_DIR/lf/memory/` si está definida; o a una nota en `~/.claude/lf/memory/notes/` enlazada desde él). Lo que lleva tiempo sin usarse baja a `<memoryDir>/archive/` y sale del índice.
4. **Enfocar.** La primera sección de `MEMORY.md` es **«Lo que se hace aquí habitualmente»**: tareas típicas, comandos de verificación y trampas conocidas. Sale del digest, no de suposiciones.

Presupuestos (no negociables): nota ≤30 líneas · `MEMORY.md` ≤60 líneas · `USER.md` ≤40 líneas. Si algo no cabe, se archiva o se resume; nunca se amplía el límite.

## Paso 2 — Reglas

- Predictivo: cada nota dice lo que la próxima sesión necesitará, no lo que pasó. Fechas absolutas.
- Una corrección o interrupción del usuario en el digest vale más que lo que dice una nota: manda la corrección.
- Nunca copies credenciales, tokens, contraseñas ni datos personales a una nota: se inyectan en todas las sesiones.
- No inventes: sin evidencia en el digest o en el código, no se escribe ni se promueve.
- No toques código, `handoff.md` ni `to-do.md`. Ni commits.

## Paso 3 — Cierre

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/dream-digest.mjs" --mark --at <generatedAt>` (guarda el instante del digest, no el de ahora: lo que otra sesión escribió mientras tanto se consolidará la próxima vez).
2. Responde solo: `+N / ~N / −N notas` (creadas / modificadas / borradas o archivadas), líneas finales de `MEMORY.md` y `USER.md`, y una línea con lo que dejaste sin comprobar. La copia previa está en `<memoryDir>/.prev.tgz`.
