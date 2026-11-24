# 0024 — GSD fuera del flujo del arnés

Fecha: 2026-11-24

Decisión: GSD (get-shit-done) deja de formar parte del arnés. Sustituye a la [0014](0014-gsd-una-orden-por-sesion-y-planner.md). El flujo L se ejecuta por hitos con `lf:planner` (solo si hay zonas grises), `lf:executor` y `lf:reviewer`, un hito por sesión, y guarda el estado en `.planning/STATE.md`. Se retiran el hook `gsd-one-per-session.sh`, los scripts `gsd-lean.sh`, `prune-gsd-hooks.sh` y `gsd-surface.cjs`, la plantilla `planning-config.json`, el paso `gsd` de `install.sh`, `optional.gsd` de `~/.claude/lf/config.json` y los avisos de GSD de `session-start.sh`.
Motivo: GSD no encaja con el flujo ni con las buenas prácticas del equipo: comitea por tarea, trae agentes y contexto propios y registra hooks que hay que podar tras cada actualización.
Alcance: el arnés deja de usarlo, instalarlo, podarlo, mencionarlo como flujo o vigilarlo. No se desinstala GSD a nadie: quien lo tenga puede dejarlo o quitarlo, no interfiere. `managed-legacy.json` conserva las reglas antiguas para limpiarlas.
Descartado: mantenerlo opcional (duplica el flujo L y su mantenimiento).
