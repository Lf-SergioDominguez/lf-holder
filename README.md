# lefebvriano-holder

Arnés de [Claude Code](https://code.claude.com) para el equipo web de Lefebvre El Derecho. Un marketplace con el plugin **`lf`** y un instalador para la configuración global. Objetivo: que Claude trabaje en tareas pequeñas y medianas **sin interrupciones** y gaste **la mitad o menos de tokens** que hoy, sin perder calidad.

## Índice

- [lefebvriano-holder](#lefebvriano-holder)
  - [Índice](#índice)
  - [1. Qué es y por qué existe](#1-qué-es-y-por-qué-existe)
  - [2. Datos: el problema medido](#2-datos-el-problema-medido)
    - [Rendimiento tras un mes de uso (septiembre–octubre 2026)](#rendimiento-tras-un-mes-de-uso-septiembreoctubre-2026)
  - [3. Cómo lo resuelve](#3-cómo-lo-resuelve)
  - [4. Instalación](#4-instalación)
    - [Si usas la extensión de VS Code](#si-usas-la-extensión-de-vs-code)
  - [5. Quickstart: ejemplos de uso](#5-quickstart-ejemplos-de-uso)
    - [Atajos](#atajos)
  - [6. Qué hay dentro](#6-qué-hay-dentro)
  - [7. Medir tu propio consumo](#7-medir-tu-propio-consumo)
  - [8. Actualizar, desactivar, volver atrás](#8-actualizar-desactivar-volver-atrás)
  - [9. Contribuye y usa bien el arnés](#9-contribuye-y-usa-bien-el-arnés)
  - [10. Contribuir](#10-contribuir)
  - [11. Decisiones de diseño](#11-decisiones-de-diseño)
  - [12. Requisitos y compatibilidad](#12-requisitos-y-compatibilidad)
  - [13. Licencia](#13-licencia)

---

## 1. Qué es y por qué existe

Usamos Claude Code a diario sobre proyectos PHP/Symfony, WordPress, Node, Astro, Vue, React y MySQL. Dos cosas nos frenaban:

- **Fricción**: pulsar «sí» a decenas de prompts de permiso y responder preguntas innecesarias en tareas de diez minutos. Los frameworks de orquestación que probamos (GSD) son excelentes para proyectos grandes, pero obligan a pasar por planificación, ejecución y revisión también para arreglar un texto.
- **Coste**: sesiones muy largas en las que cada turno relee cientos de miles de tokens de contexto.

`lefebvriano-holder` («holder» de _harness_, arnés) empaqueta la solución para que todo el equipo la instale en tres comandos, sin clonar el repo, y la mejore por PR: una política de trabajo por tamaño de tarea (S/M/L), permisos configurados para no molestar, filtros de salida, conocimiento de nuestro stack y herramientas de medición.

## 2. Datos: el problema medido

Medición sobre los transcripts locales de un desarrollador del equipo (agosto–septiembre 2026, sobre todo Sonnet 5), con `scripts/measure.sh`:

| Métrica                                                           | Antes del arnés |
| ----------------------------------------------------------------- | --------------- |
| Volumen de tokens que son **relecturas de contexto** (cache read) | 97–98 %         |
| Contexto medio releído por turno                                  | ~268K tokens    |
| Turnos por sesión                                                 | ~170            |
| Contexto fijo al abrir una sesión vacía                           | 41–47K tokens   |

Conclusión: el gasto no lo dominan las salidas de comandos, sino **el tamaño del contexto por turno y el número de turnos por tarea**. Por eso el arnés ataca primero la forma de trabajar (tareas cortas, sesiones limpias, un solo subagente barato para lo ruidoso) y la superficie siempre activa, y solo después la compresión de salidas.

Primer resultado tras desplegar (misma sesión vacía, mismo proyecto):

| Componente                   | Antes             | Después           |
| ---------------------------- | ----------------- | ----------------- |
| Skills listadas              | 101 · 6,5K tokens | 52 · 3,0K         |
| Agentes listados             | 36 · 3,7K         | 22 · 1,6K         |
| Definiciones de herramientas | 22–25K            | 11,9K             |
| **Contexto fijo total**      | **41–47K**        | **28,7K (−35 %)** |

### Rendimiento tras un mes de uso (septiembre–octubre 2026)

Transcripts de Claude Code de un desarrollador, `scripts/measure.sh --since 2026-09-01`, periodos recalculados por día real. El 18 de septiembre se instaló la v0.1.0; el 29, la v0.2.0 (Fable prohibido, Haiku como modelo de subagente, Sonnet 5.5). Del 2 al 8 de octubre se midió la v0.2 **sin RTK** (prueba A/B).

| Métrica                                    | Sin arnés (1–17 sep) | v0.1 (18–25 sep)        | v0.2 (29 sep–1 oct) | v0.2 sin RTK (2–8 oct) |
| ------------------------------------------ | -------------------- | ----------------------- | ------------------- | ---------------------- |
| Días activos                               | 13                   | 6                       | 3                   | 5                      |
| Contexto releído por petición (cache read) | 266K                 | 111K                    | 58K                 | 75K                    |
| Coste por petición (relativo a la base)    | base                 | +13 % (−38 % sin Fable) | −57 %               | −57 %                  |
| Coste por día activo (relativo a la base)  | base                 | +29 % (−39 % sin Fable) | −58 %               | −3 %                   |
| Peticiones por día                         | 282                  | 321                     | 279                 | 640                    |
| Opus (% peticiones / % coste)              | 2 % / 2 %            | 16 % / 15 %             | 16 % / 34 %         | 43 % / 56 %            |
| Sesiones de ≥300 turnos                    | 6                    | 0                       | 0                   | 0                      |

Contexto fijo de una sesión vacía en el mismo proyecto Symfony:

| Fecha  | 15–17 sep (sin arnés) | 18 sep (v0.1) | 29 sep (10 días) | 1 oct (v0.2)            | 5, 6 y 8 oct (sin RTK) |
| ------ | --------------------- | ------------- | ---------------- | ----------------------- | ---------------------- |
| Tokens | 41,4–46,6K            | 28,7K         | 24,7K            | **21,0K (−49 a −55 %)** | 21,0–21,1K             |

**Lo que dicen los datos**

- **La cifra estable es el coste por petición: −57 % respecto a la base.** El coste por día depende del volumen de trabajo (de 279 a 640 peticiones por día entre la v0.2 y la semana sin RTK). El «−81 % de coste por día» de la primera versión se midió a mediodía del 1 de octubre con datos parciales y no se sostiene.
- **La palanca es la disciplina de sesión, no la compresión.** El contexto por petición cae de 266K a 58–75K porque las sesiones son cortas (`/clear` al cerrar cada tarea, handoff en vez de compactar): se acabaron las sesiones de 300 o más turnos. Entre las sesiones sin subagentes, el contexto por petición baja de 68K a 46K y el coste por sesión baja un 53 %.
- **RTK no aportó nada medible, y pasa a ser opcional (v0.3.0).** Una semana sin RTK dio el mismo coste por petición con Sonnet (variación 0 % entre ambos periodos) y un contexto por petición con Sonnet de 62K → 64K. En la v0.2, RTK ahorraba ~0,14 % del volumen de cache read, y oculta líneas de salida (`[+N hidden: rtk recall …]`), lo que provoca turnos a ciegas. Se instala solo con `/lf:setup --with-rtk`.
- **Un modelo caro mal colocado se come el ahorro.** En la v0.1, Fable hizo el 13 % de las peticiones y el 53 % del gasto; sin él, esa semana ya había bajado un 37 % por día. Por eso la v0.2 lo prohíbe.
- **El flujo L real mueve el gasto hacia Opus.** La semana sin RTK fue la primera con el flujo L en uso real: sesiones de subagente `lf:executor` (31), `gsd-executor` (21) y `lf:reviewer` (17) en Sonnet, y `lf:planner`/`gsd-planner` (9) en Opus. Haiku pasó del 22 % al 5 % de las peticiones y Opus al 56 % del coste. Además, 13 de las 18 sesiones con Opus mezclaron Opus y Sonnet en la misma sesión, contra el consejo «Opus → `/clear` → Sonnet».
- **Interrupciones algo por encima de lo previsto.** 47 prompts de permiso en 34 sesiones (~1,4 por sesión) frente a ~0,9 antes, según `~/.claude/lf-metrics/permissions.tsv`. Uno lo provocó `filter-output` al envolver `astro check` en un pipe.

Con el arnés completo, el contexto fijo converge en **24–27K** en las tres máquinas de equipo medidas con capturas de `/context`, frente a los 41–47K de partida: las reglas globales caben en lo que se recorta en herramientas, skills y agentes. El `CLAUDE.md` global pesaba 2,1K en esas capturas; hoy pesa **4,2K**.

**Cómo leer estos datos.** Una sola persona en consumo; mezcla de trabajo distinta en cada periodo; la v0.2 son solo 3 días y la semana sin RTK, 5. Los costes son estimaciones a precio de lista con la tabla de `measure.sh`, expresadas aquí en términos relativos. Como la regla `/clear` parte el trabajo en más sesiones, el coste por sesión exagera la mejora, y el coste por día depende de cuánto se trabaje: la cifra comparable es el **coste por petición**. El siguiente paso es que cada miembro del equipo ejecute `scripts/measure.sh` y compare su antes y después.

## 3. Cómo lo resuelve

**Triaje S/M/L automático.** Antes de tocar nada, Claude clasifica la tarea en una línea y aplica el flujo correspondiente. Está en el `CLAUDE.md` global, así que ocurre solo, en todos los proyectos.

| Tamaño | Cuándo                                                              | Qué hace Claude                                                                                                                  |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **S**  | ≤3 ficheros, una capa, sin cambio de esquema ni de API              | Implementa, verifica con el comando más barato y entrega. Cero preguntas, cero prompts, sin commit.                              |
| **M**  | 4–12 ficheros o cruza capas; cambia un contrato dentro de un módulo | Escribe un contrato de ≤15 líneas, sigue sin esperar (marca «Asumo: …»), implementa por capas, revisión final con `lf:reviewer`. |
| **L**  | Módulo nuevo, >12 ficheros, decisiones de arquitectura reales       | `lf:l`: entrevista única de ≤5 preguntas, `ARCHITECTURE.md`, un OK, y ejecución por hitos delegada en GSD.                       |

**Permisos sin fricción.** `acceptEdits` + sandbox de Bash con auto-aprobación + allowlist del stack (composer, `bin/console`, npm, phpunit, docker compose exec…). `git commit`, `git push`, `composer update` y migraciones **preguntan**; PRs, `--amend`, rebase, `reset --hard`, borrados y DDL/DML destructivo están **prohibidos**. Sin modo `auto` y sin `bypassPermissions`.

**Menos contexto fijo.** GSD recortado a 15 skills y 1 hook (de 72 y 18); agentes sueltos retirados; conocimiento de stack en skills que solo se cargan al tocar sus ficheros; skills manuales con coste cero hasta invocarlas; instrucciones git integradas desactivadas.

**Salidas filtradas.** El hook propio `filter-output` envuelve los comandos ruidosos (Symfony console, Astro/Vite, PHPUnit dentro de `docker compose exec`). [RTK](https://github.com/rtk-ai/rtk) es **opcional** y no se instala por defecto (`--with-rtk`): la prueba A/B no encontró diferencia de coste ni de contexto sin él. Lo realmente ruidoso se delega al agente `lf:verbose-runner` (Haiku), que devuelve solo fallos y resumen.

**Guardia de lectura.** El hook `guard-read` deniega, con el motivo y la alternativa (`grep -n` + Read con `offset`/`limit`), leer `vendor/`, `node_modules/`, lockfiles, minificados y ficheros de más de 800 líneas o 300 KB enteros. Es un hook y no una regla `deny` porque el sandbox replica el `deny` a los procesos hijos y rompía `tsc` y `composer`. Se desactiva con `LF_READ_GUARD=0` en tu entorno (umbrales: `LF_READ_MAX_LINES`, `LF_READ_MAX_BYTES`).

**Salida del propio agente.** `/lf:caveman lite|full` (o el output style `caveman`) acorta las respuestas; es opt-in y nunca comprime código, comandos, errores ni avisos de seguridad.

**Sesiónes acotadas.** La regla es **nunca compactar**: al cerrar una tarea, `/clear`; al llegar al 75–80 % de contexto, `/lf:handoff` y sesión nueva. `autoCompactWindow: 200000` queda como red de seguridad, no como estrategia: la compactación automática pierde justo lo que no se le pide que conserve (un enfoque que ya falló, una decisión descartada).

**Política de modelos.** Solo Sonnet, Opus y Haiku; **Fable está prohibido**. Sonnet `high` por defecto, Haiku para todo subagente ruidoso, y **Opus solo para planificar** tareas L, en modo Plan — la ejecución va siempre con Sonnet. Los atajos `/lf:opusplan`, `/lf:ultrathink` y `/lf:ultracode` cubren los tres casos: ciclo completo, un turno de razonamiento profundo y sesión entera a máximo rendimiento. Detalle y comportamiento de caché en [docs/MODELOS.md](docs/MODELOS.md).

**Higiene de contexto.** Nada de basura al alcance: logs fuera del repo, sin `cat` de ficheros grandes, sin listar `vendor/`, reglas `deny` de lectura sobre logs y artefactos de build, y MCP habilitados solo por sesión y solo si se usan.

## 4. Instalación

_Para OpenCode o agentes genéricos ver [opencode-lf/README.md](opencode-lf/README.md)_
_Para Claude ver [plugins/lf/README.md](plugins/lf/README.md)_

Requisitos: Claude Code ≥ 2.1.257, `jq`, `node` ≥ 20 (solo para podar GSD) y, en Linux/WSL2, `bubblewrap` y `socat` para el sandbox. Linux, macOS o WSL2. No hace falta clonar el repo ni tener credenciales de Git.

Dentro de Claude Code (CLI o extensión de VS Code), en cualquier proyecto:

```text
/plugin marketplace add Lf-SergioDominguez/lf-holder
/plugin install lf@lefebvriano-holder
/lf:setup
```

`/lf:setup` ejecuta primero una simulación (`--dry-run`) y luego el instalador desde la caché del plugin: `CLAUDE.md` global, `settings.json` (modelo, permisos, sandbox) y poda opcional de GSD, con backup previo en `~/.claude/backups/`. Escribe en `~/.claude`, que está protegido, así que se ejecuta fuera del sandbox y Claude te pedirá permiso. Admite los mismos argumentos que el script: `/lf:setup --with-rtk`, `/lf:setup --only=settings,claude-md`, `/lf:setup --rollback`.

Si faltan `bubblewrap` y `socat`, el instalador no puede pedirte la contraseña de `sudo` desde Claude: te muestra el comando exacto (`sudo apt-get install -y bubblewrap socat`) para que lo lances tú con `!` o en un terminal.

Si prefieres clonar el repo, `scripts/install.sh` (envoltorio de `plugins/lf/scripts/install.sh`) sigue funcionando igual.

Reinicia la sesión y comprueba:

| Comando        | Debes ver                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `/context`     | Contexto fijo en torno a 25–30K; skills `lf` no aparecen hasta tocar ficheros de su stack                       |
| `/hooks`       | `lf` (filter-output, guard-read, log-permission, check-drift), `gsd-write-guard` (+ `rtk hook claude` si usas `--with-rtk`) |
| `/permissions` | `acceptEdits` con las reglas allow/ask/deny                                                                     |
| `/sandbox`     | Sin pestaña «Dependencies»; `allowedDomains` y `enableWeakerNestedSandbox` en Config                            |

### Si usas la extensión de VS Code

El plugin, los hooks, el `CLAUDE.md` global y `~/.claude/settings.json` son **compartidos** entre la extensión y la CLI, así que el arnés funciona igual. Diferencias a tener en cuenta:

1. **La CLI es opcional**: los tres comandos funcionan escritos en el cuadro de prompt de la extensión. Instálala (`curl -fsSL https://claude.ai/install.sh | bash`) solo si quieres usar `claude plugin …` o `scripts/install.sh` desde el terminal.
2. **En Windows, trabaja en una ventana Remote-WSL** (`Ctrl+Shift+P` → _WSL: Connect to WSL_). Así la extensión corre dentro de WSL, usa el `~/.claude` de WSL y el sandbox de Bash funciona; en Windows nativo el sandbox no está soportado. Ojo: la ventana conectada a WSL no basta. La extensión Claude Code tiene que aparecer en _WSL: \<distro\> - Installed_; si solo está en _Local_, pulsa **Install in WSL** y recarga la ventana. Si no, sigue corriendo en Windows (rutas `C:/…`, Git Bash) y `/lf:setup` se detiene.
3. **Marketplace y plugin**: escribe `/plugins` en el panel de Claude, pestaña _Marketplaces_, añade `Lf-SergioDominguez/lf-holder`; en la pestaña _Plugins_ instala `lf` con alcance de usuario y después ejecuta `/lf:setup`. Equivale a los comandos de la CLI y queda disponible en ambos.
4. **Modo de permisos**: la extensión puede **no leer** `permissions.defaultMode` de `settings.json`. Fija el modo en los ajustes de usuario de VS Code (`Ctrl+,` → Extensions → Claude Code → _Initial Permission Mode_ = `acceptEdits`), o elige una vez **Edit automatically** en el indicador de modo del cuadro de prompt: la elección se recuerda para las conversaciones siguientes.
5. **Comprobar**: `/context`, `/hooks` y `/permissions` funcionan igual escritos en el cuadro de prompt; el menú `/` → _Customize_ → _Hooks_ lista los hooks cargados.

Guía completa y resolución de problemas en [docs/ONBOARDING.md](docs/ONBOARDING.md).

## 5. Quickstart: ejemplos de uso

**Una tarea S** (sesión limpia en un proyecto Symfony):

```text
> Sube el límite del textarea de descripción de 1500 a 3000 caracteres y comprueba que el contador funciona.

Triaje: S — cambio de límite en una vista
[…edita el Twig y el JS, lanza php -l y el test del componente vía lf:verbose-runner…]
Ficheros: templates/product/_form.html.twig, assets/controllers/counter_controller.js
Cómo probarlo: abre /admin/products/new y escribe más de 1500 caracteres.
Tarea cerrada — recomiendo /clear antes de la siguiente
```

Ningún prompt de permiso, ninguna pregunta.

**Una tarea M**:

```text
> Añade un campo "teléfono" opcional a la entidad User, con validación E.164, y muéstralo en el perfil.

Triaje: M — entidad + migración + formulario + vista
Contrato:
- User.phone: string(20) nullable, índice no.
- Validación: #[Assert\Regex('/^\+?[1-9]\d{1,14}$/')] en el DTO de perfil.
- Migración: sí (make:migration; no la ejecuto).
- Ficheros: src/Entity/User.php, src/Form/ProfileType.php, templates/profile/show.html.twig, migrations/VersionXXXX.php
Asumo: el campo se muestra solo si no está vacío.
[…implementa por capas, verifica, lanza lf:reviewer…]
Revisión: sin hallazgos de severidad alta. Comando pendiente para ti: php bin/console doctrine:migrations:migrate
```

**Discutir la clasificación antes**: `/lf:triage <tarea>`. **Forzarla**: `/lf:s`, `/lf:m`, `/lf:l`.

**Una tarea L**: `/lf:l Sistema de suscripciones con Stripe` → ≤5 preguntas de una vez → `.planning/ARCHITECTURE.md` → tu OK → GSD por hitos con un checkpoint de 5 líneas al cerrar cada uno. Antes, `/model claude-opus-5-5` para planificar y ejecutar con Sonnet. Si la sesión se alarga, `/lf:handoff` y sesión nueva: no `/autocompact`.

**Auditoría SEO/WPO/accesibilidad**: `/lf:seo-audit src/templates --live https://staging.ejemplo.com`.

### Atajos

| Atajo                                   | Qué hace                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `/lf:opusplan <tarea>`                  | Opus planifica, Sonnet ejecuta, sin cambiar de modelo a mano                    |
| `/lf:ultrathink <pregunta>`             | Razona a fondo en **un turno**, sin subir el modelo ni el esfuerzo de la sesión |
| `/lf:ultracode <tarea>`                 | Sesión completa a xhigh y flujo multiagente (no por defecto)                    |
| `/lf:handoff`                           | Escribe `handoff.md` / `to-do.md` para retomar otro día                         |
| `/lf:triage`, `/lf:s`, `/lf:m`, `/lf:l` | Forzar el flujo de trabajo                                                      |
| `/lf:caveman [lite\|full\|off]`           | Respuestas telegráficas (opt-in); código, comandos y avisos intactos            |

Para una tarea L de verdad, lo barato es **dos sesiones**: Opus planifica → `/lf:handoff` → `/clear` → Sonnet ejecuta. `opusplan` hace las dos fases en la misma sesión y paga una invalidación de caché a cambio de comodidad. La política de modelos completa está en [docs/MODELOS.md](docs/MODELOS.md).

**Por proyecto**: copia `project-templates/CLAUDE.md` al repo y rellena solo cómo se ejecuta (local o `docker compose exec`), mapa rápido y zonas delicadas. Menos de 50 líneas.

## 6. Qué hay dentro

```text
.claude-plugin/marketplace.json   marketplace (plugins: lf)
plugins/lf/                       el plugin
  commands/                       setup · opusplan · ultrathink · ultracode · handoff
  skills/                         triage · s · m · l · caveman · prompting · symfony · wordpress ·
                                  frontend-astro-vue-react · mysql-doctrine · seo-audit · 6 adaptadas (MIT)
  agents/                         verbose-runner (haiku) · reviewer (sonnet) · planner (opus) · executor (sonnet)
  hooks/                          filter-output.sh · guard-read.sh · log-permission.sh · check-drift.sh
  output-styles/                  caveman (opt-in, se elige en /config)
  home/                           CLAUDE.md global y fragmento de settings que aplica install.sh
  scripts/                        install.sh · merge-settings.sh · prune-gsd-hooks.sh · gsd-surface.cjs
project-templates/                CLAUDE.md, settings.local.json y config de GSD por proyecto
scripts/                          install.sh (envoltorio) · measure.sh · test-hooks.sh
opencode-lf/                      puerto nativo del arnés a OpenCode (AGENTS.md, commands/, agents/, plugins/lf.ts)
docs/                             ONBOARDING · MODELOS · PROMPTING · ERRORES-COMUNES · CONTRIBUTING ·
                                  DECISIONS · brief original · templates/ (handoff, todo, agent)
metrics/                          mediciones locales de measure.sh (no se versiona)
```

Detalle de skills, agentes y hooks con su coste en tokens: [plugins/lf/README.md](plugins/lf/README.md). Qué va en el plugin, qué en `install.sh` y qué en cada proyecto: [docs/ONBOARDING.md](docs/ONBOARDING.md).

## 7. Medir tu propio consumo

```bash
scripts/measure.sh --since 2026-09-01
```

Agrega `~/.claude/projects/**/*.jsonl` (nunca sale de tu máquina) y produce coste estimado, contexto medio por turno, turnos por sesión y desglose por día y modelo. Los prompts de permiso quedan registrados en `~/.claude/lf-metrics/permissions.tsv`; si instalas RTK, `rtk gain` muestra lo que ahorra. Compara antes y después de cualquier cambio: es la única forma de saber si una herramienta que promete reducir tokens lo hace o solo añade una capa.

## 8. Actualizar, desactivar, volver atrás

```text
/plugin marketplace update lefebvriano-holder
/lf:setup
```

Al iniciar sesión, el hook `check-drift` te avisa si la versión del plugin no coincide con la marca de tu `~/.claude/CLAUDE.md`; `/lf:setup` la resincroniza. Tras `/gsd-update`: `/lf:setup --only=gsd` (GSD vuelve a registrar sus hooks; el mismo hook te avisará).

Volver atrás: `/lf:setup --rollback` restaura el último backup de `settings.json` y `CLAUDE.md` (en `~/.claude/backups/`); `/plugin uninstall lf@lefebvriano-holder`; `rtk init -g --uninstall` (solo si instalaste RTK); `/gsd-surface reset`. Kill-switch de todos los hooks: `"disableAllHooks": true`.

## 9. Contribuye y usa bien el arnés

- **Errores que más caro salen** (configuración por defecto, sesión reutilizada, salidas gigantes, agent teams por defecto, CI sin filtros…) y **checklist diaria**: [docs/ERRORES-COMUNES.md](docs/ERRORES-COMUNES.md).
- **Cómo escribir peticiones** que produzcan trabajo verificable: [docs/PROMPTING.md](docs/PROMPTING.md) y la skill `/lf:prompting`.

## 10. Contribuir

Regla básica: **todo lo que se añade cuesta tokens a todo el equipo en cada sesión**. Prefiere skills manuales (`disable-model-invocation`) o por `paths`, y hooks que no imprimen nada cuando no aplican. Cómo añadir una skill, un agente o un hook, cómo probar en local y cuándo subir versión: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Historial en [CHANGELOG.md](CHANGELOG.md).

## 11. Decisiones de diseño

Por qué GSD se recorta en vez de desinstalarse, por qué Smith se descartó, por qué agent-skills se vendoriza en vez de instalarse como plugin, por qué RTK es opcional tras medirlo, y las trampas del sandbox en WSL2: [docs/DECISIONS.md](docs/DECISIONS.md). El punto de partida fue [docs/brief-original.md](docs/brief-original.md).

## 12. Requisitos y compatibilidad

- Claude Code ≥ 2.1.257 (probado en 2.1.276), CLI o extensión de VS Code (comparten configuración; ver [instalación](#si-usas-la-extensión-de-vs-code))..
- Linux, macOS o WSL2 (Windows nativo no soporta el sandbox). En WSL2 hace falta `enableWeakerNestedSandbox`, ya incluido.
- GSD es opcional (el instalador pregunta antes de tocarlo) y RTK también: no se instala salvo con `--with-rtk` o `--only=rtk`. El arnés funciona sin ellos.
- Modelos: `claude-sonnet` (el más nuevo) por defecto, Haiku para subagentes, `claude-opus` (el más nuevo) solo para planificar tareas L. **Fable no se usa en ningún flujo.** Ver [docs/MODELOS.md](docs/MODELOS.md).

## 13. Licencia

[MIT](LICENSE). Las seis skills adaptadas de [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) conservan su aviso MIT en [plugins/lf/LICENSE-agent-skills](plugins/lf/LICENSE-agent-skills) y [opencode-lf/LICENSE-agent-skills](opencode-lf/LICENSE-agent-skills).
