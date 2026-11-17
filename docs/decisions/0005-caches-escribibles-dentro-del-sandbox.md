# 0005 — Cachés escribibles dentro del sandbox

Fecha: 2026-09-18

Decisión: `sandbox.filesystem.allowWrite: ["~/.npm", "~/.cache", "~/.bun", "~/.config/composer", "~/.local/share/rtk"]`; `install.sh` crea los directorios si faltan. Desde el 2026-10-08 `~/.local/share/rtk` va en `home/settings.rtk.json` y solo se añade al instalar RTK.
Motivo: por defecto el sandbox solo permite escribir en el proyecto y `$TMPDIR`; `npm install`, `composer install` y `bun install` fallarían al escribir su caché y provocarían el reintento fuera del sandbox (un prompt cada vez). `rtk` guarda su base de datos de ahorro en `~/.local/share/rtk`.
