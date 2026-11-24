# 0022 — `/lf:setup` guiado y perfiles de equipo

Fecha: 2026-11-23

Decisión: el núcleo del arnés es genérico y cada equipo concreta stack, ramas, flujo de deploy y gates en un **perfil** (`plugins/lf/profiles/<nombre>.md`, frontmatter `name` y `description`). Hay dos de serie: `web` y `generic`; otros equipos añaden el suyo por PR. `/lf:setup` pregunta perfil, telemetría sí/no y opcionales, y `install.sh` (paso `config`, flags `--profile=` y `--telemetry=`) guarda las elecciones en `~/.claude/lf/config.json` (`version`, `profile`, `telemetry`, `telemetryEvery` (`weekly` por defecto o `monthly`; se pregunta en el setup; `month-ends` se retiró en 0023), `windows`, `optional.taste`, `optional.gsd`) y copia los perfiles a `~/.claude/lf/profiles/`, ruta estable como la de los docs.
Motivo: hipótesis de VISION.md (pauta 1): con el perfil fuera del núcleo, H3 (gates en local) y H2 (telemetría) leen de un solo sitio en lugar de forks por equipo. Métrica: equipos con perfil propio sin tocar el núcleo.
Alcance: H1 solo guarda la elección de telemetría; el informe y el envío son H2 (ADR 0023). Sin flags, una segunda ejecución conserva lo guardado; sin config previa, `generic` y telemetría desactivada.
Descartado: un fork por equipo (rompe la paridad) y preguntar Windows otra vez (ya lo resuelve el paso 0a).
