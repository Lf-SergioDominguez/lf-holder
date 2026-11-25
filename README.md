# lefebvriano-holder

Arnés de [Claude Code](https://code.claude.com) para el equipo web de Lefebvre El Derecho: un marketplace con el plugin **`lf`** y un instalador para la configuración global. Objetivo: que Claude trabaje en tareas pequeñas y medianas **sin interrupciones** y gaste **la mitad o menos de tokens**, sin perder calidad.

Si tienes problemas de permisos usa el [mirror público](https://github.com/Lf-SergioDominguez/lf-holder).

## Qué resuelve

Usamos Claude Code sobre PHP/Symfony, WordPress, Node, Astro, Vue, React y MySQL. Nos frenaban dos cosas:

- **Fricción**: decenas de prompts de permiso y preguntas innecesarias en tareas de diez minutos.
- **Coste**: sesiones largas en las que cada turno relee cientos de miles de tokens.

Los datos (transcripts de un desarrollador, `scripts/measure.sh`): el 97–98 % del volumen eran relecturas de contexto (~268K por turno, ~170 turnos por sesión). Tras el arnés, el coste por petición baja un ~57 % y el contexto fijo de una sesión vacía pasa de 41–47K a ~21K tokens. La palanca es la disciplina de sesión, no la compresión de salidas. Cifras, periodos y límites de la medición: [docs/decisions/](docs/decisions/README.md) (0007, 0008 y 0016).

## Cómo lo resuelve

- **Triaje S/M/L** en una línea antes de tocar nada: S implementa y entrega sin preguntar; M escribe un contrato de ≤15 líneas y sigue; L entrevista una vez, escribe `ARCHITECTURE.md` y ejecuta por hitos con `lf:executor`.
- **Permisos sin fricción**: `acceptEdits` + sandbox de Bash + el hook `bash-gate`, que clasifica cada comando (`allow`/`ask`/`deny`). Commit, push, migraciones y `rm` preguntan; borrados masivos y DDL/DML destructivo están prohibidos. Detalle: [PERMISOS.md](plugins/lf/docs/PERMISOS.md).
- **Menos contexto fijo**: `CLAUDE.md` global ≤70 líneas, skills de stack que solo cargan al tocar sus ficheros.
- **Salidas acotadas**: `trim-output` recorta lo ruidoso y avisa siempre de lo omitido; lo muy verboso va al agente `lf:verbose-runner` (Haiku). `guard-read` impide leer `vendor/`, lockfiles o ficheros enormes enteros.
- **Sesiones cortas**: nunca compactar; `/clear` al cerrar tarea y `/lf:handoff` al llegar al 75–80 %. Ver [MEMORIA.md](plugins/lf/docs/MEMORIA.md).
- **Modelos**: solo Sonnet, Opus y Haiku; Opus solo para planificar tareas L. Ver [MODELOS.md](plugins/lf/docs/MODELOS.md).

## Instalación

Requisitos: Claude Code ≥ 2.1.295, `jq`, `node` ≥ 22 y, en Linux/WSL2, `bubblewrap` y `socat`. Windows nativo funciona sin sandbox (`/lf:setup --windows`). No hace falta clonar el repo.

```text
/plugin marketplace add Lf-SergioDominguez/lf-holder
/plugin install lf@lefebvriano-holder
/lf:setup
```

`/lf:setup` simula primero (`--dry-run`), hace backup en `~/.claude/backups/` y aplica `CLAUDE.md`, y `settings.json`. Admite `--only=settings,claude-md` y `--rollback`. Para OpenCode: [opencode-lf/README.md](opencode-lf/README.md).

Reinicia y comprueba con `/context` (contexto fijo ~25K), `/hooks`, `/permissions` y `/sandbox`. Guía completa, extensión de VS Code y resolución de problemas: [docs/ONBOARDING.md](docs/ONBOARDING.md).

## Uso

```text
> Sube el límite del textarea de descripción de 1500 a 3000 caracteres.

Triaje: S — cambio de límite en una vista
[…edita, verifica con el comando más barato…]
Ficheros: templates/product/_form.html.twig, assets/controllers/counter_controller.js
Tarea cerrada — recomiendo /clear antes de la siguiente
```

| Atajo | Qué hace |
| --- | --- |
| `/lf:triage`, `/lf:s`, `/lf:m`, `/lf:l` | Discutir o forzar el flujo |
| `/lf:opusplan <tarea>` | Opus planifica, Sonnet ejecuta |
| `/lf:ultracode <tarea>` | Sesión a xhigh y multiagente (no por defecto) |
| `/lf:handoff` | Escribe `handoff.md` / `to-do.md` para retomar otro día |
| `/lf:caveman [lite\|full\|off]` | Respuestas telegráficas (opt-in) |
| `/lf:seo-audit <ruta>` | Auditoría SEO/WPO/accesibilidad |

Para razonar a fondo en un turno escribe `ultrathink` en el prompt. Por proyecto, copia `project-templates/CLAUDE.md` y rellena solo cómo se ejecuta, el mapa rápido y las zonas delicadas.

## Qué hay dentro

```text
.claude-plugin/marketplace.json   marketplace (plugin lf)
plugins/lf/                       commands · skills · agents · hooks · home · scripts · docs · templates
project-templates/                CLAUDE.md, settings.local.json y quality-gates.yml (CI)
scripts/                          install.sh (envoltorio) · measure.sh · test-hooks.sh
opencode-lf/                      puerto del arnés a OpenCode
docs/                             ONBOARDING · CONTRIBUTING · decisions/ · brief-original
```

Skills, agentes y hooks con su coste en tokens: [plugins/lf/README.md](plugins/lf/README.md).

## Medir, actualizar, volver atrás

```bash
scripts/measure.sh --since 2026-09-01    # coste, contexto por turno, turnos por sesión (local)
```

Actualizar: `/plugin marketplace update lefebvriano-holder` y `/lf:setup`; al iniciar sesión, `session-start` avisa si la versión del plugin no coincide con la marca de tu `CLAUDE.md`. Volver atrás: `/lf:setup --rollback` y `/plugin uninstall lf@lefebvriano-holder`. Kill-switch de hooks: `"disableAllHooks": true`.

## Documentación

- Usar bien el arnés: [PROMPTING](plugins/lf/docs/PROMPTING.md) y [ERRORES-COMUNES](plugins/lf/docs/ERRORES-COMUNES.md).
- Contribuir (todo lo que se añade cuesta tokens a todo el equipo): [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) y [CHANGELOG.md](CHANGELOG.md).
- Hacia dónde va: [docs/VISION.md](docs/VISION.md).
- Por qué es así: [docs/decisions/README.md](docs/decisions/README.md); punto de partida en [docs/brief-original.md](docs/brief-original.md).

## Licencia

[MIT](LICENSE). Las skills adaptadas de [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) y las reglas de [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail) conservan su aviso en `plugins/lf/LICENSE-*` y `opencode-lf/LICENSE-*`.
