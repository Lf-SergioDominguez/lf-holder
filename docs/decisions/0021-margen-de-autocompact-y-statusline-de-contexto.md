# 0021 — Margen de autocompact y statusline de contexto

Fecha: 2026-11-17

Decisión: el límite de trabajo sigue siendo **200K** (handoff al 75–80 %, es decir, 150–160K), pero `autoCompactWindow` pasa de 200000 a **220000** para que el autocompact quede como red de seguridad y no se cruce con el handoff. Además el plugin instala una `statusLine` (`scripts/statusline.sh` → `~/.claude/lf/statusline.sh`) que muestra siempre `ctx 142k/200k 71%`: gris por debajo del 75 %, amarillo desde el 75 % y rojo con «→ /lf:handoff» desde el 80 %. `merge-settings.sh` no pisa una `statusLine` ajena.
Motivo: el % nativo solo aparece junto al autocompact; al terminar una tarea con «8 % restante» el autocompact saltaba antes de poder escribir el handoff (~5K). Con 20K de margen el handoff cabe, y la statusline lo avisa a 150K, no a 190K. Sigue siendo seguro porque Sonnet 5 corre siempre con ventana de 1M (ADR 0006).
Alternativas descartadas: desactivar el autocompact (si se llega al tope ni cabe el handoff); un hook que avise al modelo al 75 % (gasta tokens y la statusline ya lo hace gratis).
Ajuste: `LF_CTX_LIMIT` cambia el límite que usa la statusline; el valor de `autoCompactWindow` se ajusta por sesión con `/autocompact`.

## Addendum 2026-11-23 — la statusline mide contra el umbral real

Problema: en un proyecto cuyo `.claude/settings.json` conservaba `autoCompactWindow: 200000` (pisa el 220000 de usuario), la statusline marcaba «166k/200k 83 % → /lf:handoff» y el autocompact saltó durante el handoff. Claude Code no compacta al 100 % de la ventana sino hacia `autoCompactWindow − ~33K` (≈20K de reserva de salida + ≈13K de margen): con 200000, hacia los 167K, justo ese 83 %.
Decisión: la statusline lee el `autoCompactWindow` efectivo (proyecto local > proyecto > usuario), usa `window − 33000` como denominador y colorea por tokens que faltan: amarillo con <30K, rojo con «→ /lf:handoff» con <20K. `session-start.sh` avisa si el valor efectivo es <220000. `LF_CTX_LIMIT` ahora fuerza el umbral directamente.
Descartado: mantener el 200K fijo (dos bases distintas para un mismo aviso) y escribir el settings del proyecto desde el plugin (es fichero del repo, lo decide el equipo).
