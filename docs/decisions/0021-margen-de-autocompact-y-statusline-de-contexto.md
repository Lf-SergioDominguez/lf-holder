# 0021 — Margen de autocompact y statusline de contexto

Fecha: 2026-11-17

Decisión: el límite de trabajo sigue siendo **200K** (handoff al 75–80 %, es decir, 150–160K), pero `autoCompactWindow` pasa de 200000 a **220000** para que el autocompact quede como red de seguridad y no se cruce con el handoff. Además el plugin instala una `statusLine` (`scripts/statusline.sh` → `~/.claude/lf/statusline.sh`) que muestra siempre `ctx 142k/200k 71%`: gris por debajo del 75 %, amarillo desde el 75 % y rojo con «→ /lf:handoff» desde el 80 %. `merge-settings.sh` no pisa una `statusLine` ajena.
Motivo: el % nativo solo aparece junto al autocompact; al terminar una tarea con «8 % restante» el autocompact saltaba antes de poder escribir el handoff (~5K). Con 20K de margen el handoff cabe, y la statusline lo avisa a 150K, no a 190K. Sigue siendo seguro porque Sonnet 5 corre siempre con ventana de 1M (ADR 0006).
Alternativas descartadas: desactivar el autocompact (si se llega al tope ni cabe el handoff); un hook que avise al modelo al 75 % (gasta tokens y la statusline ya lo hace gratis).
Ajuste: `LF_CTX_LIMIT` cambia el límite que usa la statusline; el valor de `autoCompactWindow` se ajusta por sesión con `/autocompact`.
