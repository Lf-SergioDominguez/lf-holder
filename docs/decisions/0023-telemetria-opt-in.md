# 0023 — Telemetría opt-in (`/lf:telemetry`)

Fecha: 2026-11-24

Decisión: `/lf:telemetry status|preview|send|off` (script `plugins/lf/scripts/telemetry.mjs`, sin dependencias). El informe es agregado, anónimo y se valida contra la lista blanca `telemetry-schema.json`; si trae una clave de más, aborta (exit 2) sin imprimir nada. `send` abre una issue con etiqueta `telemetry` en `Lf-SergioDominguez/lf-holder-metrics` usando `gh` (la cuenta de quien envía), y solo entonces avanza `lastSent` en `~/.claude/lf/telemetry-state.json`; el periodo de cada informe va de `lastSent` a ahora. `off` pone `telemetry: false` en `config.json`.
Frecuencia: `weekly` (7 días) o `monthly` (30). `month-ends` (inicio y final de mes) se retira: exigía dos disparos por mes con periodos desiguales y no aportaba nada que `monthly` no cubra. Un `month-ends` ya guardado se lee y se reescribe como `monthly`.
Privacidad: desactivada por defecto; solo cuentas de sesiones, tokens, `ask`/`deny` y errores de hooks, nunca texto, rutas, proyectos ni ids de sesión. El envío siempre es manual (`send`), con vista previa y confirmación en el comando; no hay envío automático en segundo plano.
Descartado: envío automático en SessionStart (sin vista previa) y un endpoint propio (hay que mantenerlo; una issue ya identifica al remitente y la ingesta es una GitHub Action del repo de métricas).
