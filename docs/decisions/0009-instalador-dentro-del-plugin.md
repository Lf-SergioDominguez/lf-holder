# 0009 — Instalador dentro del plugin (v0.4.0)

Fecha: 2026-10-13

Decisión: `install.sh`, `merge-settings.sh`, `prune-gsd-hooks.sh`, `gsd-surface.cjs` y `home/` se mueven a `plugins/lf/` y se lanzan con el comando `/lf:setup`. `scripts/install.sh` en la raíz queda como envoltorio de una línea para clones existentes. El marketplace pasa a `Lf-SergioDominguez/lf-holder` (el nombre `lefebvriano-holder` y la clave `lf@lefebvriano-holder` no cambian).
Motivo: solo `plugins/lf/` llega a la caché del plugin, así que el instalador, para ser accesible en `${CLAUDE_PLUGIN_ROOT}`, tiene que vivir ahí. Instalar pasa de «clonar repo + script + marketplace» a tres comandos sin clonar y sin credenciales de Git (el repo es público).
Consecuencias: (1) `sudo` para `bubblewrap` y `socat` no puede pedir contraseña desde Claude; el instalador sin TTY muestra el comando exacto y sigue. (2) El plugin no puede fijar settings por sí mismo: `/lf:setup` los fusiona en `~/.claude`, fuera del sandbox y con permiso del usuario. (3) El hook `check-drift` compara la marca `<!-- lf-harness X.Y.Z -->` de la primera línea de `~/.claude/CLAUDE.md` con la versión del plugin y avisa en una línea si falta o difiere.
Alternativa descartada: que el hook `SessionStart` aplique los settings solo; escribir en `~/.claude` sin que el usuario lo vea rompe la regla de que lo global lo decide siempre la persona.
