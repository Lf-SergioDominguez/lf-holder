# 0010 — Guardia de lectura por hook y caveman opt-in (v0.5.0)

Fecha: 2026-10-13

Decisión: (1) la lectura de `vendor/`, `node_modules/`, `.git/`, `var/cache/`, `dist/`, `public/build/`, `coverage/`, minificados, source maps y lockfiles, y de ficheros de más de 800 líneas o 300 KB sin `offset`/`limit`, se bloquea con el hook `guard-read.sh` (`PreToolUse` sobre `Read`), no con `permissions.deny`. (2) El modo de salida telegráfica se ofrece como `/lf:caveman [lite|full|off]` y como output style `caveman`, siempre opt-in. `filter-output.sh` acepta además un único prefijo `cd <ruta> && ` y escribe su log por sesión.
Motivo: (1) el sandbox convierte las reglas `deny` de lectura en `denyRead` para los procesos hijos y rompía `tsc`, `composer`, `php bin/console` y `git` (ver la decisión 9 del 2026-09-15). Un hook solo ve las llamadas a la herramienta `Read` del agente, no las de los procesos, así que da el mismo ahorro sin ese efecto, y explica qué hacer en su lugar. Solo habla cuando deniega, por lo que no cae en el «ruido en cada llamada» que motivó descartar un hook en la decisión 5 del 2026-09-29. (2) Comprimir por defecto puede perder matices en revisiones, planes y avisos; como opción de sesión, la persona decide cuándo le compensa.
Alternativa descartada: volver a `permissions.deny` para esas rutas (rompe el sandbox) y activar caveman en `settings.lf.json` (`outputStyle`).
