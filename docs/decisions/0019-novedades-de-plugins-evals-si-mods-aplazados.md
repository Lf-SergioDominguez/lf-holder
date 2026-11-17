# 0019 — Novedades de plugins: evals sí, mods aplazados

Fecha: 2026-11-17

Decisión: se adoptan los **plugin evals** (`claude plugin eval`) y la validación conjunta (`claude plugin validate`) como parte del flujo de release (hito 4), y se fija **2.1.295** como versión mínima de Claude Code (cubre `Concise`, `modelSettings`, `onFailure` y evals). Los **mods** (paneles, bandas, status line, toasts propios) se aplazan.
Motivo: los evals verifican skills, agentes y comandos antes de publicar, que es donde el arnés ha fallado (versiones sin subir, descripciones largas). Un mod añade superficie que mantener y no resuelve ninguno de los tres problemas actuales (permisos, tokens, memoria).
Alternativa descartada: adoptar mods ahora para mostrar el estado del gate o el consumo; se reevalúa cuando haya medición que lo justifique.
