# 0006 — Sonnet 5 siempre corre con 1M: hay que fijar `autoCompactWindow`

Fecha: 2026-09-18

Decisión: `autoCompactWindow: 200000` en el fragmento global. Para una tarea L larga: `/autocompact 600k` en la sesión (lo guarda en user settings; volver con `/autocompact 200k`) o `claude --autocompact 600000` para un solo arranque.
Motivo: quitar el sufijo `[1m]` no cambia nada en Sonnet 5: en la API de Anthropic siempre tiene ventana de 1M y no existe variante de 200K; compacta a ~967K por defecto. Sin tope, una sesión larga relee cientos de miles de tokens por turno (línea base: 268K/turno). Con 200K el coste por turno queda acotado; la compactación cuesta una petición completa, pero el `/clear` por tarea del flujo S/M la evita casi siempre.
Alternativa descartada: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` (bloquea también Fable/Opus para L) y `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (env: no se puede subir por sesión con `/autocompact`).
