# Plugin `lf`

Parte instalable como plugin de Claude Code del arnés lefebvriano-holder. Se instala con:

```text
/plugin marketplace add Lf-SergioDominguez/lf-holder
/plugin install lf@lefebvriano-holder
/lf:setup
```

La otra mitad (settings globales, CLAUDE.md, poda de GSD y, opcional con `--with-rtk`, RTK, y con `--with-taste`, la skill de diseño taste-skill) la aplica `/lf:setup`, que ejecuta `scripts/install.sh` desde la propia caché del plugin (los ficheros viven en `home/` y `scripts/` de este directorio).

## Skills

| Skill                                                                                                                                                                                          | Invocación                 | Coste siempre activo       | Para qué                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `triage`                                                                                                                                                                                       | `/lf:triage <tarea>`       | 0                          | Clasificar S/M/L y proponer flujo antes de ejecutar                                                                                               |
| `s`, `m`                                                                                                                                                                                       | `/lf:s`, `/lf:m`           | 0                          | Forzar el flujo S o M                                                                                                                             |
| `caveman`                                                                                                                                                                                      | `/lf:caveman [lite\|full\|off]` | 0                          | Respuestas telegráficas opt-in (lite o full); código, comandos y avisos intactos. También como output style `caveman` en `/config`                |
| `l`                                                                                                                                                                                            | `/lf:l` o automática       | descripción                | Flujo L: entrevista ≤5 preguntas → ARCHITECTURE.md → GSD por hitos                                                                                |
| `symfony`, `wordpress`, `frontend-astro-vue-react`, `mysql-doctrine`                                                                                                                           | automática por `paths`     | 0 hasta tocar sus ficheros | Convenciones y comandos del stack                                                                                                                 |
| `seo-audit`                                                                                                                                                                                    | `/lf:seo-audit`            | 0                          | Auditoría técnica SEO/WPO/a11y en contexto aparte                                                                                                 |
| `prompting`                                                                                                                                                                                    | `/lf:prompting <petición>` | 0                          | Cómo pedir las cosas y cómo revisar las instrucciones del arnés                                                                                   |
| 6 skills adaptadas (`debugging-and-error-recovery`, `code-review-and-quality`, `api-and-interface-design`, `incremental-implementation`, `security-and-hardening`, `performance-optimization`) | automática                 | descripción                | Debugging, revisión, diseño de API, implementación incremental, seguridad, rendimiento (de agent-skills, MIT; licencia en `LICENSE-agent-skills`) |

La §9 «Código mínimo» del CLAUDE.md global y los criterios *lean* de `executor` y `reviewer` se destilan de [ponytail](https://github.com/dietrichgebert/ponytail) (MIT; licencia en `LICENSE-ponytail`).

## Comandos

| Invocación                  | Qué hace                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/lf:setup [args]`          | Aplica en `~/.claude` el CLAUDE.md global, los settings y la poda de GSD desde la caché del plugin (simulación y ejecución real fuera del sandbox). Guiado: pregunta qué opcionales activar (RTK, taste-skill, poda de GSD). Admite `--with-rtk`, `--with-taste`, `--only=…`, `--rollback` |
| `/lf:rtk [on\|off\|status]` | Activa, desactiva o consulta el hook de RTK en `settings.json` (con backup; `off` deja el binario). Requiere reiniciar la sesión |
| `/lf:opusplan <tarea>`      | Ciclo Opus planifica → Sonnet ejecuta, sin cambiar de modelo a mano. Paga una invalidación de caché; para una L de verdad, mejor sesión Opus → `/lf:handoff` → `/clear` → sesión Sonnet |
| `/lf:ultrathink <pregunta>` | Razona a fondo en **un solo turno**, sin subir el modelo ni el esfuerzo de la sesión                                                                                                    |
| `/lf:ultracode <tarea>`     | Sesión completa a xhigh y flujo multiagente. No por defecto                                                                                                                             |
| `/lf:handoff`               | Escribe o actualiza `handoff.md` / `to-do.md` para retomar la sesión en otro día                                                                                                        |

## Agentes

- `lf:verbose-runner` (haiku): ejecuta tests/builds/consola y devuelve solo fallos y resumen.
- `lf:reviewer` (sonnet): revisión final de solo lectura del diff, ≤10 hallazgos priorizados.
- `lf:planner` (opus): plan de ejecución por capas, hitos y verificaciones. No escribe código.
- `lf:executor` (sonnet): ejecuta **un hito** de un plan ya cerrado, verifica cada paso y revisa con `lf:reviewer`.

Cadena recomendada para una L: `lf:planner` (Opus) → handoff y `/clear` → `lf:executor` (Sonnet) por hito. Los ejecutores van **en serie**: dos escribiendo en el mismo árbol se pisan. Nada de agent teams: según estimaciones cuestan ~7× más y acortan la ventana de trabajo.

## Hooks

- `PreToolUse Bash` → `filter-output.sh`: envuelve con filtros los comandos ruidosos que RTK no cubre (Symfony console, PHPUnit dentro de Docker, Astro/Vite, tsc, composer, npm install, wp, mysql). Acepta un único prefijo `cd <ruta> && `. Passthrough en pipes, redirecciones, heredocs y comandos compuestos. Log completo por sesión en `${TMPDIR:-/tmp}/lf-out-<session_id>.log`.
- `PreToolUse Read` → `guard-read.sh`: deniega con motivo útil la lectura de `vendor/`, `node_modules/`, `.git/`, `var/cache/`, `dist/`, `public/build/`, `coverage/`, minificados, source maps y lockfiles, y de ficheros de más de 800 líneas o 300 KB sin `offset`/`limit` (sugiere `grep -n` + Read acotado). `vendor/`, `node_modules/` y `.git/` casan en cualquier segmento de la ruta relativa al cwd; `var/cache/`, `dist/`, `public/build/` y `coverage/` solo en la raíz del proyecto; fuera del cwd solo se aplican las reglas de nombre y de tamaño. Variables de entorno de la persona (el agente no las ve en el motivo): `LF_READ_GUARD=0` lo desactiva; `LF_READ_MAX_LINES=N` y `LF_READ_MAX_BYTES=N` cambian los umbrales.
- `PermissionRequest` → `log-permission.sh`: registra cada prompt de permiso en `~/.claude/lf-metrics/permissions.tsv`.
- `SessionStart` → `check-drift.sh`: avisa en una línea si `~/.claude/CLAUDE.md` no tiene la marca `<!-- lf-harness X.Y.Z -->`, si no coincide con la versión del plugin o si GSD volvió a registrar sus hooks. Silencioso en el resto de casos.

Pruebas: `scripts/test-hooks.sh`.

## Modelos

Solo **Sonnet, Opus y Haiku**; **Fable está prohibido**. Sonnet `high` por defecto, Haiku para el ruido (`CLAUDE_CODE_SUBAGENT_MODEL` y `model:` por subagente), Opus solo para planificar tareas L. Detalle completo, caché y comportamiento de `autoCompactWindow` en [docs/MODELOS.md](../../docs/MODELOS.md).
