# Plugin `lf`

Parte instalable como plugin de Claude Code del arnés lefebvriano-holder. Se instala con:

```text
/plugin marketplace add Lf-SergioDominguez/lf-holder
/plugin install lf@lefebvriano-holder
/lf:setup
```

La otra mitad (settings globales, CLAUDE.md y, opcional con `--with-taste`, la skill de diseño taste-skill) la aplica `/lf:setup`, que ejecuta `scripts/install.sh` desde la propia caché del plugin (los ficheros viven en `home/` y `scripts/` de este directorio).

## Skills

| Skill                                                                                                                                                                                          | Invocación                 | Coste siempre activo       | Para qué                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `triage`                                                                                                                                                                                       | `/lf:triage <tarea>`       | 0                          | Clasificar S/M/L y proponer flujo antes de ejecutar                                                                                               |
| `s`, `m`                                                                                                                                                                                       | `/lf:s`, `/lf:m`           | 0                          | Forzar el flujo S o M                                                                                                                             |
| `caveman`                                                                                                                                                                                      | `/lf:caveman [lite\|full\|off]` | 0                          | Respuestas telegráficas opt-in (lite o full); código, comandos y avisos intactos. También como output style `caveman` en `/config`                |
| `l`                                                                                                                                                                                            | `/lf:l` o automática       | descripción                | Flujo L: entrevista ≤5 preguntas → ARCHITECTURE.md → hitos con `lf:executor`                                                                      |
| `dream`                                                                                                                                                                                        | `/lf:dream`                | 0                          | Consolida la memoria entre sesiones (corregir, estructurar, promover, enfocar); ver [MEMORIA](docs/MEMORIA.md)                                    |
| `symfony`, `wordpress`, `frontend-astro-vue-react`, `mysql-doctrine`                                                                                                                           | automática por `paths`     | 0 hasta tocar sus ficheros | Convenciones y comandos del stack                                                                                                                 |
| `seo-audit`                                                                                                                                                                                    | `/lf:seo-audit`            | 0                          | Auditoría técnica SEO/WPO/a11y en contexto aparte                                                                                                 |
| `prompting`                                                                                                                                                                                    | `/lf:prompting <petición>` | 0                          | Cómo pedir las cosas y cómo revisar las instrucciones del arnés                                                                                   |
| 6 skills adaptadas (`debugging-and-error-recovery`, `code-review-and-quality`, `api-and-interface-design`, `incremental-implementation`, `security-and-hardening`, `performance-optimization`) | automática                 | descripción                | Debugging, revisión, diseño de API, implementación incremental, seguridad, rendimiento (de agent-skills, MIT; licencia en `LICENSE-agent-skills`) |

La §9 «Código mínimo» del CLAUDE.md global y los criterios *lean* de `executor` y `reviewer` se destilan de [ponytail](https://github.com/dietrichgebert/ponytail) (MIT; licencia en `LICENSE-ponytail`).

## Comandos

| Invocación                  | Qué hace                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/lf:setup [args]`          | Aplica en `~/.claude` el CLAUDE.md global y los settings desde la caché del plugin (simulación y ejecución real fuera del sandbox). Guiado: pregunta perfil de equipo (`profiles/`), telemetría sí/no y opcionales (taste-skill); guarda las elecciones en `~/.claude/lf/config.json`. Admite `--profile=`, `--telemetry=on\|off`, `--telemetry-every=weekly\|monthly`, `--with-taste`, `--only=…`, `--rollback` |
| `/lf:telemetry status\|preview\|send\|off` | Telemetría opt-in: estado, JSON exacto que se enviaría (validado contra una lista blanca), envío como issue a `lf-holder-metrics` con tu cuenta de GitHub, y desactivación. Nunca prompts, código, rutas, proyectos ni ids de sesión |
| `/lf:opusplan <tarea>`      | Ciclo Opus planifica → Sonnet ejecuta, sin cambiar de modelo a mano. Paga una invalidación de caché; para una L de verdad, mejor sesión Opus → `/lf:handoff` → `/clear` → sesión Sonnet |
| `/lf:ultracode <tarea>`     | Sesión completa a xhigh y flujo multiagente. No por defecto                                                                                                                             |
| `/lf:handoff`               | Escribe o actualiza `handoff.md` / `to-do.md` para retomar la sesión en otro día                                                                                                        |
| `/lf:house-style [ruta\|--reset]` | Almacena un house style (carpeta o `.md`) en `~/.claude/lf/house-style/` para que el arnés lo consulte al construir UI. Este repo no trae uno de serie: instala el tuyo con una ruta |

## Agentes

- `lf:verbose-runner` (haiku): ejecuta tests/builds/consola y devuelve solo fallos y resumen.
- `lf:reviewer` (haiku): revisión final de solo lectura del diff, ≤10 hallazgos priorizados.
- `lf:planner` (opus): plan de ejecución por capas, hitos y verificaciones. No escribe código.
- `lf:executor` (sonnet): ejecuta **un hito** de un plan ya cerrado, verifica cada paso y revisa con `lf:reviewer`.

Cadena recomendada para una L: `lf:planner` (Opus) → handoff y `/clear` → `lf:executor` (Sonnet) por hito. Los ejecutores van **en serie**: dos escribiendo en el mismo árbol se pisan. Nada de agent teams: según estimaciones cuestan ~7× más y acortan la ventana de trabajo.

## Hooks

- `PreToolUse Bash` → `bash-gate.sh` (`gate/classify.mjs`): clasifica el comando completo y decide `allow`/`ask`/`deny` (deny > ask > allow); quita el `cd <cwd> &&` redundante. `LF_GATE=on|shadow|off`. Detalle en [docs/PERMISOS.md](docs/PERMISOS.md).
- `PostToolUse Bash` → `trim-output.mjs`: recorta salidas largas de comandos ruidosos, avisa siempre de lo omitido y deja la salida completa en `${TMPDIR:-/tmp}`.
- `PreToolUse Read` → `guard-read.sh`: deniega con motivo útil la lectura de `vendor/`, `node_modules/`, `.git/`, `var/cache/`, `dist/`, `public/build/`, `coverage/`, minificados, source maps y lockfiles, y de ficheros de más de 800 líneas o 300 KB sin `offset`/`limit` (sugiere `grep -n` + Read acotado). `vendor/`, `node_modules/` y `.git/` casan en cualquier segmento de la ruta relativa al cwd; `var/cache/`, `dist/`, `public/build/` y `coverage/` solo en la raíz del proyecto; fuera del cwd solo se aplican las reglas de nombre y de tamaño. Variables de entorno de la persona (el agente no las ve en el motivo): `LF_READ_GUARD=0` lo desactiva; `LF_READ_MAX_LINES=N` y `LF_READ_MAX_BYTES=N` cambian los umbrales.
- `PermissionRequest` → `log-permission.sh`: registra cada prompt de permiso en `~/.claude/lf-metrics/permissions.tsv`.
- `SessionStart` → `session-start.sh`: avisa en una línea si `~/.claude/CLAUDE.md` no tiene la marca `<!-- lf-harness X.Y.Z -->`, si no coincide con la versión del plugin, si quedan reglas antiguas (allows amplios o RTK) en `settings.json` o si el `autoCompactWindow` efectivo es <253000. Además avisa si hay `handoff.md` en el cwd y si hay ≥5 sesiones (o ≥7 días) sin consolidar (`/lf:dream`). Silencioso en el resto de casos.
- `PreCompact` → `precompact.sh`: añade a las instrucciones del resumen las decisiones, enfoques descartados, ficheros modificados y próximo paso. No evita la compactación.

Pruebas: `scripts/test-hooks.sh`.

## Modelos

Solo **Sonnet, Opus y Haiku**; **Fable está prohibido**. Sonnet `medium` por defecto (`high` en tareas M/L complejas), Haiku para el ruido (`CLAUDE_CODE_SUBAGENT_MODEL` y `model:` por subagente), Opus solo para planificar tareas L. Detalle completo, caché y comportamiento de `autoCompactWindow` en [docs/MODELOS.md](docs/MODELOS.md). Más: [PERMISOS](docs/PERMISOS.md), [MEMORIA](docs/MEMORIA.md), [PROMPTING](docs/PROMPTING.md) y [ERRORES-COMUNES](docs/ERRORES-COMUNES.md).
