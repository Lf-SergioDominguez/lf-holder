# 0008 — RTK opcional (v0.3.0)

Fecha: 2026-10-08

Decisión: RTK deja de instalarse por defecto. `install.sh` ejecuta `deps,claude-md,settings,gsd`; RTK se añade con `--with-rtk` o `--only=rtk` (`--yes` no lo activa). El hook `rtk hook claude`, `Bash(rtk *)` y `~/.local/share/rtk` salen de `plugins/lf/home/settings.lf.json` y viven en `plugins/lf/home/settings.rtk.json`, que el paso `rtk` fusiona con `merge-settings.sh`. No se borra del repo: puede seguir siendo útil en sesiones L largas.
Motivo: prueba A/B de una semana sin RTK (2–8 oct, mediciones locales) frente a la v0.2 con RTK (29 sep–1 oct). Con Sonnet, el coste por petición fue idéntico (variación 0 %) y el contexto por petición pasó de 62K a 64K. En la v0.2 RTK ahorraba ~0,14 % del volumen de cache read. Además oculta líneas de salida (`[+N hidden: rtk recall …]`), lo que provoca turnos a ciegas. El contexto fijo no cambió (21,0–21,1K en `/context` del 5, 6 y 8 oct).
Salvedades: la semana sin RTK fue también la primera con el flujo L en uso real (`lf:executor`, `gsd-executor`, `lf:reviewer` en Sonnet; `lf:planner`/`gsd-planner` en Opus), así que el coste por día (de −58 % a −3 % respecto a la base) y el reparto de modelos (Opus del 34 % al 56 % del coste, Haiku del 22 % al 5 % de las peticiones) no son atribuibles a RTK. Una persona, 3 + 5 días.
Corrección de cifras: el «−81 % de coste por día» publicado antes se midió a mediodía del 1 oct con datos parciales y no se sostiene. La cifra estable es el coste por petición: −57 % respecto a la base.
Alternativa descartada: quitar RTK del repo. Nota: `merge-settings.sh` une entradas y nunca borra, así que quien ya lo tenga instalado debe quitar a mano el hook de `~/.claude/settings.json` (`rtk init -g --uninstall`).
