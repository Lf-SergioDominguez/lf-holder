# 0016 — Retirada de RTK

Fecha: 2026-11-17

Decisión: RTK sale del arnés. Se borran `commands/rtk.md`, `scripts/rtk.sh`, `home/settings.rtk.json` y el bloque de `install.sh` (flags `--with-rtk`/`--only=rtk`); `install.sh` quita la línea `@RTK.md` de `~/.claude/CLAUDE.md`, y `merge-settings.sh --prune` retira `Bash(rtk *)`, `~/.local/share/rtk` y el hook `rtk hook claude` de quien ya lo tenía (vía `home/managed-legacy.json`). `session-start.sh` avisa si sigue en `settings.json`. El recorte de salida lo hace ahora el hook propio `trim-output.mjs`, que siempre avisa de lo omitido.
Motivo: la prueba del 2026-10-08 (ADR 0008) ya mostró variación 0 % en coste por petición; además `@RTK.md` añadía contexto fijo en cada sesión y los recortes silenciosos provocaban turnos a ciegas.
Alternativa descartada: dejarlo opcional. Cuesta mantener un flujo de instalación, un comando, tests y documentación para algo sin beneficio medido.
Pendiente del usuario: desinstalar el binario `rtk` (`rtk init -g --uninstall`).
