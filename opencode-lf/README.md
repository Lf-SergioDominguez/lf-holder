# `lf` para OpenCode

Arnés del equipo web de Lefebvre El Derecho, en el formato nativo de OpenCode: `AGENTS.md`, comandos, agentes, skills y plugins. Reimplementa las prácticas del arnés original sobre una base de modelos distinta —los gratuitos del catálogo de OpenCode— y está pensada para mantenerse independiente de aquel.

## Instalación

Copia esta carpeta a tu configuración global de OpenCode (afecta a todos tus proyectos):

```bash
cp -r opencode-lf/AGENTS.md opencode-lf/opencode.json opencode-lf/package.json ~/.config/opencode/
cp -r opencode-lf/agents opencode-lf/commands opencode-lf/skills opencode-lf/plugins ~/.config/opencode/
```

O, si prefieres activarlo solo en un proyecto, copia el contenido dentro de `.opencode/` en la raíz del repo (excepto `opencode.json`, que puede quedarse en la raíz del proyecto o fusionarse con el `opencode.json` global — OpenCode fusiona configuración global y de proyecto).

**Ojo con los nombres de directorio: son en plural.** `~/.config/opencode/agents/` y `~/.config/opencode/commands/`. Con `agent/` y `command/` en singular, OpenCode carga los ficheros pero no registra ni el agente ni el comando, y no da ningún error visible.

`package.json` es necesario: sin él, `plugins/lf.ts` no puede importar el tipo `Plugin` de `@opencode-ai/plugin`. OpenCode ejecuta `bun install` al arrancar; si no se dispara solo, ejecútalo una vez a mano en `~/.config/opencode/`.

## Qué se instala

| Pieza                                                            | Origen (arnés original)                          | Equivalente aquí                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Reglas globales (modelos, contexto)                              | reglas globales del arnés original              | `AGENTS.md`                                                              |
| Permisos (`allow`/`ask`/`deny`)                                  | `permissions` del arnés original                | `opencode.json` → `permission.bash`                                      |
| Bloqueo de secretos y basura                                     | `permissions.deny` (`Read(...)`)                 | `opencode.json` → `permission.read` con globs + `plugins/lf.ts` de apoyo |
| Filtro de comandos ruidosos                                      | hook de filtrado de salida                      | `plugins/lf.ts` → hook `tool.execute.before`                             |
| Registro de fricción de permisos                                 | hook de log de permisos                          | `plugins/lf.ts` → hook `permission.ask`                                  |
| Compactación con memoria                                         | compactación con instrucciones                   | `plugins/lf.ts` → hook `experimental.session.compacting`                 |
| Modelos siempre al día                                           | identificadores fijos por modelo                 | `plugins/modelo.ts` → hook `config`, alias `opencode/{estandar,planificacion,ligero}:latest` |
| Deriva de hooks de una herramienta externa                        | hook de detección de deriva                      | **No portado** — la herramienta no existe en OpenCode                   |
| Agente ejecutor silencioso                                       | `agents/verbose-runner.md`                       | `agents/verbose-runner.md` (modelo ligero)                               |
| Agente de revisión                                               | `agents/reviewer.md`                             | `agents/reviewer.md` (modelo estándar)                                  |
| Planificador / ejecutor, con modelos distintos                    | `agents/{planner,executor}.md`                   | `agents/{planner,executor}.md`                                           |
| Auditor SEO/WPO/a11y                                             | skill `seo-audit` (command-only)                 | `agents/seo-audit.md` + skill `seo-audit/` (conocimiento)                |
| Skills de stack (auto)                                           | `skills/{symfony,wordpress,...}`                 | `skills/{symfony,wordpress,...}` (formato idéntico)                      |
| `/triage`, `/s`, `/m`                                            | skills con invocación por modelo                 | `commands/{triage,s,m}.md`                                               |
| `/l` (también automático)                                        | skill `l`                                        | `skills/l/SKILL.md` (auto) + `commands/l.md` (manual)                    |
| `/opusplan`, `/ultrathink`, `/ultracode`, `/handoff`             | `commands/*.md`                                  | `commands/{opusplan,ultrathink,ultracode,handoff}.md`                    |
| `/caveman [lite\|full\|off]`                                       | skill `caveman` + output style `caveman`         | `commands/caveman.md` (solo comando, sin output style)                   |
| skill `prompting`                                                | `skills/prompting/SKILL.md`                      | `skills/prompting/SKILL.md`                                              |
| Distribución vía marketplace                                     | marketplace con plugin                           | **No aplica** — OpenCode no tiene marketplace; se copian ficheros        |

## Diferencias que debes conocer

- **La base de modelos es otra y es la diferencia de fondo.** Aquí no hay gama de modelos con coste: hay tres **roles** resueltos a modelos gratuitos del catálogo de OpenCode. La política (planificar con uno, ejecutar con otro, delegar el ruido en el tercero) es la misma; los identificadores no tienen nada que ver. Lo que el arnés protege ya no es "no usar el modelo caro" sino "no salir del nivel gratuito": `plugins/modelo.ts` filtra por coste 0 antes que por familia.
- **Modelos: alias, no identificadores.** `opencode.json` y los subagentes llevan alias de rol: `opencode/estandar:latest`, `opencode/planificacion:latest`, `opencode/ligero:latest`. `plugins/modelo.ts` (hook `config`) los resuelve al arrancar contra el catálogo de models.dev y deja el identificador del modelo gratuito más reciente de esa familia, saltando `alpha`/`beta`/`deprecated`. Así, cuando el catálogo rota un `-free` retirado por uno nuevo, el arnés lo adopta sin tocar un solo fichero. Tres límites que conviene conocer: el alias **no** se resuelve al cambiar de modelo en caliente (`/model opencode/estandar:latest` no vale; en el TUI hay que elegir en `/models` el modelo gratuito más reciente), sin red y sin caché el alias se queda sin resolver y OpenCode usa su modelo por defecto, y si una familia entera desaparece del catálogo el alias tampoco resuelve. El catálogo se cachea 24 h en `~/.cache/opencode/lf-modelos.json`, ya recortado a los gratuitos (unos pocos KB frente a los 5 MB del catálogo completo). Añadir una familia nueva es tocar `FAMILIES` en `plugins/modelo.ts`. La política completa (roles, esfuerzo, subagentes) está en [MODELOS.md](MODELOS.md).
- **La ejecución por hitos deja de delegarse.** El flujo L del arnés original entregaba la ejecución por hitos a una herramienta externa que no existe en OpenCode. En `AGENTS.md` la sección 4 tiene una ejecución manual por hitos que sigue el mismo criterio que el flujo M, y el skill `l` ya no la invoca. Si tu equipo adopta algo equivalente en OpenCode, actualiza ese apartado.
- **`paths` en las skills de stack es decorativo aquí.** El arnés original usaba ese campo para precargar la skill solo cuando se toca un fichero que encaja con el glob. El `SKILL.md` nativo de OpenCode solo reconoce `name`, `description`, `license`, `compatibility` y `metadata`; el campo `paths` se queda en el fichero pero OpenCode lo ignora, así que la skill se ofrece por descripción, no por ruta tocada. Si quieres el comportamiento exacto de "coste 0 hasta tocar sus ficheros", tendrías que añadir esa lógica a `plugins/lf.ts` (comprobar `output.args.filePath`/`command` en `tool.execute.before` e inyectar la skill correspondiente a mano).
- **El `$ARGUMENTS` de `l` y `seo-audit` como skill.** Cuando `l` se auto-invoca (no vía `/l`), el cuerpo de la skill sigue conteniendo literalmente `$ARGUMENTS` — solo se sustituye cuando se invoca como comando. El modelo interpreta ese marcador como "la tarea en curso" cuando no hay sustitución real.
- **Los permisos por ruta de lectura no existen en `opencode.json`.** El bloqueo de `.env.local`, `.env.*.local` y `~/.ssh/**` está reimplementado como parte de `plugins/lf.ts` (hook `tool.execute.before` sobre la tool `read`), porque `permission` en `opencode.json` no tiene una categoría de ruta para lecturas.
- **Compactación**: OpenCode no expone `/compact`; compacta sola cuando el contexto se llena. El hook `experimental.session.compacting` de `plugins/lf.ts` inyecta en el resumen las decisiones, los enfoques descartados, los ficheros modificados y el próximo paso, que es justo lo que el resumen por defecto tira. No evita la compactación: la hace recuperable. La estrategia sigue siendo `/handoff` + `/new`.
- **`ultrathink` y `ultracode`**: OpenCode no tiene un campo `effort` en comandos, así que la diferencia se aplica por modelo y por prompt: `ultrathink` fija el agente `plan` (esfuerzo alto, sin cambiar el modelo de la sesión) y `ultracode` fija el modelo de planificación y describe el flujo multiagente. No son equivalentes a la versión original, pero siguen marcando la diferencia entre gastar más en un turno y gastar más en toda la sesión.

## No portado / fuera de alcance

- Los scripts de instalación y medición del arnés original (`plugins/lf/scripts/install.sh`, `merge-settings.sh`, `prune-gsd-hooks.sh`, `gsd-surface.cjs`, y `scripts/measure.sh`): automatizan la instalación dentro de otro ecosistema y no tienen sentido tal cual en OpenCode. Si quieres medición de uso (tokens, fricción de permisos) aquí, `plugins/lf.ts` ya escribe `permissions.tsv` como base, pero falta el resto de la instrumentación.
- El mecanismo de distribución por marketplace del arnés original: OpenCode no lo tiene. Aquí la instalación es copiar ficheros, como describe la sección de arriba.
- El nombre `/opusplan`: el comando planifica con el modelo de planificación y ejecuta con el estándar, pero conserva el nombre histórico para no romper la costumbre del equipo. El texto del comando ya no nombra ningún modelo.
