# 0020 — House style corporativo de serie y `/lf:house-style`

Fecha: 2026-11-17 (antes de 1.0.0)

Contexto: las aplicaciones que desarrolla el equipo deben salir con la marca nueva (Lefebvre 2026) sin que cada proyecto la reexplique, y quien quiera otro house style debe poder cambiarlo sin tocar el plugin.

Decisión: el plugin trae el house style en `plugins/lf/house-style/` (7 `.md`, índice `INDEX.md`). `/lf:setup` lo copia a `~/.claude/lf/house-style/` (ruta estable, como `docs/`), `home/CLAUDE.md` y la skill `lf:frontend-astro-vue-react` mandan leer `INDEX.md` antes de maquetar, y `/lf:house-style [carpeta|.md|--reset]` (script `house-style.sh`) lo sustituye. Un destino con `.custom` no lo pisa `/lf:setup`; `--reset` vuelve al de serie.
Excepción: el azul `#001978` identifica a la sucursal de España y se admite (token `--lf-brand-spain`) como identidad, nunca como acción principal; el rojo `#D71635` manda en la jerarquía.
Motivo: una sola fuente consultable por todas las sesiones, con coste de una línea en el CLAUDE.md global; el contenido se lee bajo demanda, no se inyecta.
Alternativas descartadas: inyectar el house style con `@import` (69 KB en cada sesión); referenciarlo por proyecto (se desfasa y no es corporativo por defecto).
Asumo: la redacción de la excepción del azul España es conservadora; se amplía editando `color.md §6`. El repo público no incluye el contenido de marca, solo el comando y el instalador.
