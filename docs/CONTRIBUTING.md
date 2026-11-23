# Contribuir a lefebvriano-holder

## Cómo contribuir

Este repositorio es una réplica publicada del arnés y **no acepta pull requests**: los cambios se desarrollan aparte y llegan aquí con cada versión.

- **Errores:** abre un issue con la plantilla *Bug*.
- **Ideas y propuestas:** issue con la plantilla *Mejora*, o una discusión si aún es una idea abierta. Comprueba antes si choca con una decisión ya tomada (`docs/decisions/`).
- **Dudas:** [SUPPORT.md](../SUPPORT.md). **Seguridad:** [SECURITY.md](../SECURITY.md). **Código de conducta:** [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md).

Si quieres adaptar el arnés a tu equipo, haz un fork (licencia [MIT](../LICENSE)); el resto de esta guía explica cómo extenderlo sin disparar el coste en tokens.

## Principio

Cada cosa que añadimos al arnés tiene un coste en tokens **en todas las sesiones de todo el equipo**. Antes de añadir, pregúntate: ¿se carga siempre o solo cuando hace falta?

| Tipo                                       | Coste siempre activo                                        | Cuándo usarlo                                          |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| Skill con `disable-model-invocation: true` | 0 (solo la invoca el usuario con `/lf:<nombre>`)            | Flujos manuales, utilidades                            |
| Skill con `paths:`                         | 0 hasta tocar un fichero que case                           | Conocimiento de stack                                  |
| Skill normal                               | Su `description` en cada turno                              | Solo si el modelo debe decidir usarla solo             |
| Agente                                     | Su `description` en cada turno + contexto nuevo al lanzarlo | Solo para aislar salidas ruidosas o revisiones         |
| Hook                                       | Un proceso por evento; 0 tokens si no imprime nada          | Automatismos deterministas                             |
| Línea en `plugins/lf/home/CLAUDE.md`       | Siempre, en todos los proyectos                             | Reglas globales imprescindibles (≤70 líneas en total)  |

## Añadir un perfil

Un perfil concreta, para un equipo, lo que el núcleo deja genérico: stack, ramas, flujo de deploy y gates que bloquean o avisan. No es una skill ni se carga solo: `/lf:setup` lo ofrece y lo guarda en `~/.claude/lf/config.json`.

1. Copia `plugins/lf/profiles/generic.md` a `plugins/lf/profiles/<equipo>.md` (nombre en minúsculas, dígitos y guiones) y mantén las secciones *Stack*, *Ramas*, *Deploy* y *Gates*. Frontmatter: `name` igual que el fichero y `description` de una línea.
2. Describe solo lo que tu equipo hace de verdad, en pocas líneas: es contexto que otros leerán.
3. Comprueba con `CLAUDE_CONFIG_DIR=$(mktemp -d) bash plugins/lf/scripts/install.sh --only=config --profile=<equipo>`.

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
5. Anota en el CHANGELOG qué problema resuelve y su coste en tokens (siempre activo o bajo demanda) y, si añade descripción visible, compara `/context` antes y después.

## Añadir un agente

Solo si aísla trabajo ruidoso o necesita otro modelo. Frontmatter mínimo: `name`, `description` (≤120 caracteres, sin bloques `<example>`), `model` (haiku para ejecutar, leer logs y revisar; sonnet para implementar), `effort`, `tools` restringidas, `maxTurns`, `omitClaudeMd: true`. Plantilla en `docs/templates/agent-template.md`.

## Añadir un hook

En `plugins/lf/hooks/hooks.json`, comando `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<script>.sh"` (o `node …/<script>.mjs`), `timeout` ≤5 s. El script debe salir 0 sin salida cuando no aplica (cero tokens). Si decide permisos, la lógica va en una función pura testeable (ver `hooks/gate/classify.mjs` y `tests/gate.test.mjs`). Añade casos a `scripts/test-hooks.sh` y ejecútalo.

## Desarrollo local, evals y release

- **Probar sin instalar:** `claude --plugin-dir ./plugins/lf` y `/reload-plugins` tras cada cambio.
- **Evals** (`plugins/lf/evals/`, ADR 0019): cinco casos sobre lo que el plugin aporta (`/lf:handoff`, `/lf:s`, `/lf:m`, `/lf:triage` y un caso negativo que no debe disparar ningún flujo). Corren en un config aislado, **sin tu `CLAUDE.md` global**, y comparan con y sin plugin (Δ). `claude plugin eval plugins/lf --allow-tools Write Edit --max-cost-usd 5 --no-publish`; para depurar un caso, `--case <glob> --runs 1 --keep-temp`. Gastan tokens de tu cuenta: no se lanzan en cada cambio. Las reglas de permisos (`DELETE`, `--dry-run`) no se evalúan aquí: las cubren `tests/gate-cases.tsv` y `scripts/test-hooks.sh`.
- **Release:** `bash scripts/release.sh` (versiones coherentes en ambos manifiestos, marca de `home/CLAUDE.md` y CHANGELOG; `claude plugin validate --strict`; `test-hooks.sh`, que ya lanza `node --test`; y `claude plugin tag --dry-run`, que exige árbol limpio). Con `--evals` añade la suite. Si todo pasa, `claude plugin tag plugins/lf --push` lo lanza el mantenedor.

## Decisiones de diseño

Una decisión que cambia el comportamiento del arnés se registra como ADR en `docs/decisions/` (plantilla e índice en su `README.md`).

## Cambiar settings globales o CLAUDE.md

Edita `plugins/lf/home/settings.lf.json` o `plugins/lf/home/CLAUDE.md` (si cambias este último, actualiza también la marca `<!-- lf-harness X.Y.Z -->` de la línea 1 al subir versión), ejecuta `plugins/lf/scripts/install.sh --dry-run --only=settings,claude-md` con `CLAUDE_CONFIG_DIR=$(mktemp -d)` y revisa el diff antes de instalar. Recuerda que `CLAUDE.md` se lee en **todos** los proyectos de **todos**: cada línea debe ganarse su sitio.

## Medir

`scripts/measure.sh --since AAAA-MM-DD` agrega el consumo real de tus transcripts locales (no sale del equipo; `metrics/` está en `.gitignore`). Compara `cache_read / turno`, `turnos / sesión` y `coste / sesión` antes y después de un cambio.

## Estilo

- Español en descripciones, documentación y mensajes al usuario; inglés en identificadores, código y commits (Conventional Commits).
- Rutas nunca absolutas en el plugin: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}`.
- Sin secretos, sin URLs internas con credenciales, sin datos de clientes en ejemplos.
