# 0004 — `blockReadsOutsideWorkingDirectories` rompe el stack dentro del sandbox

Fecha: 2026-09-18

Decisión: `permissions.blockReadsOutsideWorkingDirectories: false`; secretos protegidos con `permissions.deny Read(~/.ssh/**)`, `~/.claude/.credentials.json`, `~/.config/gh/hosts.yml` (el sandbox replica esas denegaciones; **un directorio denegado que no existe rompe bwrap**, por eso no se listan `~/.aws` ni `~/.gnupg` y `install.sh` crea `~/.ssh` si falta); `git` y `gh` en `sandbox.excludedCommands` para que usen la clave SSH y el token bajo las reglas allow/ask/deny.
Motivo: con esa clave activa (venía de GSD) el sandbox oculta todo `/root`: `node` cae a la v18 del sistema en vez de la v24 de nvm, `bun` y `rtk` no existen, composer pierde la caché. Verificado el 2026-09-18.
Alternativa descartada: `sandbox.filesystem.allowRead` con la lista de directorios de herramientas (frágil: cada herramienta nueva rompe).
