---
description: Almacena un house style (carpeta o .md) en ~/.claude/lf/house-style/ para aplicarlo en toda la UI que se desarrolle.
argument-hint: "[carpeta|fichero.md | --reset]"
model: sonnet
---

Argumento: **$ARGUMENTS**

Instala el house style que indique el usuario como el que el arnés consulta siempre (`~/.claude/lf/house-style/INDEX.md`). El de serie es el de Lefebvre 2026; `/lf:setup` lo instala y no pisa uno personalizado.

## Paso 0 — Argumento

Solo se admite vacío (estado), `--reset` (vuelve al de serie) o una ruta. Cualquier otra cosa: dilo y no ejecutes nada. Si hay ruta, comprueba con `ls` que existe y que es una carpeta o un `.md`.

## Paso 1 — Revisar la fuente (solo si hay ruta)

Antes de instalar, lee el índice de la fuente (`INDEX.md`, `README.md` o el `.md` que enlaza a los demás; si solo hay uno, ese) y comprueba que describe de verdad un house style: color, tipografía, espaciado, componentes o tono. Si es otra cosa, dilo y para. No leas nada fuera de esa ruta ni modifiques su contenido.

## Paso 2 — Instalar

Ejecuta `bash "${CLAUDE_PLUGIN_ROOT}/scripts/house-style.sh" $ARGUMENTS`. Resuelve `${CLAUDE_PLUGIN_ROOT}` como en `/lf:setup` si llega vacía. Escribe en `~/.claude`, protegido por el sandbox: lánzalo con `dangerouslyDisableSandbox: true` y deja que el usuario lo apruebe; si lo deniega, no insistas.

## Paso 3 — Cierre

Máximo 6 líneas: lo que imprimió el script (ficheros instalados, avisos de enlaces rotos o de índice creado) y `Se aplica desde la próxima sesión. Para volver al de serie: /lf:house-style --reset`.
