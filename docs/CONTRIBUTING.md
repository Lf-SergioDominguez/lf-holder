# Contribuir a lefebvriano-holder

## Principio

Cada cosa que añadimos al arnés tiene un coste en tokens **en todas las sesiones de todo el equipo**. Antes de añadir, pregúntate: ¿se carga siempre o solo cuando hace falta?

| Tipo                                       | Coste siempre activo                                        | Cuándo usarlo                                          |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| Skill con `disable-model-invocation: true` | 0 (solo la invoca el usuario con `/lf:<nombre>`)            | Flujos manuales, utilidades                            |
| Skill con `paths:`                         | 0 hasta tocar un fichero que case                           | Conocimiento de stack                                  |
| Skill normal                               | Su `description` en cada turno                              | Solo si el modelo debe decidir usarla solo             |
| Agente                                     | Su `description` en cada turno + contexto nuevo al lanzarlo | Solo para aislar salidas ruidosas o revisiones         |
| Hook                                       | Un proceso por evento; 0 tokens si no imprime nada          | Automatismos deterministas                             |
| Línea en `plugins/lf/home/CLAUDE.md`       | Siempre, en todos los proyectos                             | Reglas globales imprescindibles (<100 líneas en total) |

## Añadir una skill

1. Crea `plugins/lf/skills/<nombre>/SKILL.md` con frontmatter:

   ```yaml
   ---
   name: <nombre> # igual que la carpeta, kebab-case
   description: <≤150 caracteres, en español, empieza por verbo o "Úsala cuando…">
   paths: "<globs>" # si es de stack
   disable-model-invocation: true # si es manual
   effort: low|medium|high # opcional
   allowed-tools: Read Grep Glob … # opcional, restringe herramientas
   ---
   ```

2. Cuerpo ≤150 líneas: procedimientos, reglas, anti-patrones. Nada de prosa motivacional. Ficheros de apoyo en la misma carpeta, referenciados con `${CLAUDE_PLUGIN_ROOT}/skills/<nombre>/…`.
3. Prueba en local: `/plugin marketplace add /ruta/al/repo` → `/plugin install lf@lefebvriano-holder` → `/lf:<nombre>`; comprueba con `/context` que el listado de skills no crece más de lo esperado.
4. Sube `version` en `.claude-plugin/marketplace.json` **y** en `plugins/lf/.claude-plugin/plugin.json` (misma versión) y la marca `<!-- lf-harness X.Y.Z -->` de `plugins/lf/home/CLAUDE.md`. Sin bump, los compañeros no reciben la actualización.
5. PR con: qué problema resuelve, coste en tokens (siempre activo o bajo demanda), captura de `/context` antes/después si añade descripción visible.

## Añadir un agente

Solo si aísla trabajo ruidoso o necesita otro modelo. Frontmatter mínimo: `name`, `description` (≤200 caracteres), `model` (haiku para ejecutar, leer logs y revisar; sonnet para implementar), `tools` restringidas, `maxTurns`, `omitClaudeMd: true`. Plantilla en `docs/templates/agent-template.md`.

## Añadir un hook

En `plugins/lf/hooks/hooks.json`, comando `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<script>.sh"`, `timeout` ≤5 s. El script debe salir 0 sin salida cuando no aplica (cero tokens). Añade casos a `scripts/test-hooks.sh` y ejecútalo.

## Cambiar settings globales o CLAUDE.md

Edita `plugins/lf/home/settings.lf.json` o `plugins/lf/home/CLAUDE.md` (si cambias este último, actualiza también la marca `<!-- lf-harness X.Y.Z -->` de la línea 1 al subir versión), ejecuta `plugins/lf/scripts/install.sh --dry-run --only=settings,claude-md` con `CLAUDE_CONFIG_DIR=$(mktemp -d)` y pega el diff en el PR. Recuerda que `CLAUDE.md` se lee en **todos** los proyectos de **todos**: cada línea debe ganarse su sitio.

## Medir

`scripts/measure.sh --since AAAA-MM-DD` agrega el consumo real de tus transcripts locales (no sale del equipo; `metrics/` está en `.gitignore`). Compara `cache_read / turno`, `turnos / sesión` y `coste / sesión` antes y después de un cambio.

## Estilo

- Español en descripciones, documentación y mensajes al usuario; inglés en identificadores, código y commits (Conventional Commits).
- Rutas nunca absolutas en el plugin: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}`.
- Sin secretos, sin URLs internas con credenciales, sin datos de clientes en ejemplos.
