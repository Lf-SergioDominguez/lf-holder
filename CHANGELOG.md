# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Versionado semántico; la versión vive en `.claude-plugin/marketplace.json` y `plugins/lf/.claude-plugin/plugin.json`.

## [Unreleased]

## [0.5.2] — 2026-10-13

### Añadido

- `/lf:setup` en Windows nativo pregunta si instalar en WSL (muestra los pasos de *Install in WSL*) o en Windows. Nuevo flag `--windows` en `/lf:setup` e `install.sh`: implica `--no-sandbox` (`sandbox.enabled: false`, `defaultMode: dontAsk`), y si falta `jq` pide instalarlo con `winget install jqlang.jq`. Sin el flag, `install.sh` sigue parando en Windows y sugiere `--windows` (salvo `--rollback`); con el flag fuera de Windows, para. Al terminar en Windows avisa de que WSL tiene su propia configuración y requiere instalar el plugin y repetir `/lf:setup` allí.

## [0.5.1] — 2026-10-13

### Corregido

- `/lf:setup` e `install.sh` detectan Windows nativo (`MINGW`, `MSYS`, `CYGWIN` o rutas `C:/…`) y paran antes de usar `jq` o tocar `~/.claude`. Es el caso de la extensión de VS Code instalada solo en local aunque la ventana esté conectada a WSL. El mensaje indica cómo instalarla en WSL (*Install in WSL* → *Reload Window* → `/plugins` → `/lf:setup`). README y ONBOARDING lo explican.

## [0.5.0] — 2026-10-13

Guardia de lectura, filtro de salidas más completo y modo de salida telegráfica opt-in. Quien ya tenga el arnés instalado: `/plugin marketplace update lefebvriano-holder` y `/lf:setup`.

### Añadido

- **Hook `guard-read.sh`** (`PreToolUse`, matcher `Read`). Deniega, con el motivo y la alternativa, la lectura de `vendor/`, `node_modules/`, `.git/`, `var/cache/`, `dist/`, `public/build/` y `coverage/`; de minificados (`*.min.js`, `*.min.css`), `*.map` y lockfiles (`package-lock.json`, `composer.lock`, `yarn.lock`, `pnpm-lock.yaml`); y de ficheros de más de 800 líneas o 300 KB sin `offset`/`limit`. Las rutas se evalúan contra el `cwd` de la sesión: `vendor/`, `node_modules/` y `.git/` en cualquier segmento; `var/cache/`, `dist/`, `public/build/` y `coverage/` solo en la raíz; fuera del cwd, solo nombre de fichero y tamaño. Escapes (entorno de la persona): `LF_READ_GUARD=0`, `LF_READ_MAX_LINES=N` y `LF_READ_MAX_BYTES=N`.
- **Modo caveman (opt-in).** Skill `/lf:caveman [lite|full|off]`, output style `caveman` (`plugins/lf/output-styles/caveman.md`, se elige en `/config`) y comando `/caveman` en `opencode-lf`. No se activa por defecto. Nunca comprime código, comandos, rutas, errores citados, commits, avisos de seguridad ni preguntas al usuario, y mantiene explícitos negaciones, condiciones, cantidades y estado de verificación.

### Cambiado

- `filter-output.sh` acepta un único prefijo `cd <ruta> && ` delante del comando y lo conserva en el comando envuelto. Con más de un `&&`, `;`, `||` o pipes sigue en passthrough.
- El log completo de las salidas filtradas es por sesión: `${TMPDIR:-/tmp}/lf-out-<session_id>.log` (antes un único `lf-last-output.log` que las sesiones paralelas se pisaban; sin `session_id` se mantiene el nombre antiguo).
- Rutas y herramientas de la organización fuera de las reglas globales: `home/CLAUDE.md` y `opencode-lf/AGENTS.md` remiten al `CLAUDE.md` del proyecto para la ruta y la ejecución, y hablan de «gestor de tareas» en vez de una herramienta concreta. §6 enlaza con `/lf:caveman`.
- `scripts/test-hooks.sh`: casos del prefijo `cd`, del log por sesión y de `guard-read.sh` (72 comprobaciones).

### Corregido

- `filter-output.sh`: en builds (`npm run build`, `astro build`, `vite build`…) el `tail -n 3` final pisaba `${PIPESTATUS[0]}` y un build fallido salía con código 0. Ahora se guarda el estado antes del `tail`; test de regresión en `scripts/test-hooks.sh`.
- `filter-output.sh`: sustituye `head -n N` por `awk 'NR<=N'`, que lee toda la entrada y evita el SIGPIPE que mataba a mitad comandos largos (p. ej. `wp search-replace`); `updatedInput` conserva el resto de `tool_input` (`timeout`, `description`…), que antes se perdía; pasan sin envolver los comandos con `&` o `#`; las rutas del log van entre comillas.

### Documentación

- README, `plugins/lf/README.md` y `opencode-lf/README.md` con el skill, el hook y el output style nuevos. `docs/DECISIONS.md`: decisión «Guardia de lectura por hook y caveman opt-in» (2026-10-13).

## [0.4.0] — 2026-10-13

Instalación en tres comandos, sin clonar el repo, y preparación para publicar el repositorio. Quien ya tenga el arnés instalado: `/plugin marketplace update lefebvriano-holder` y `/lf:setup`.

### Añadido

- **Comando `/lf:setup`.** Ejecuta `install.sh` desde la caché del plugin: primero `--dry-run` con resumen, luego la ejecución real (fuera del sandbox, con permiso del usuario). Admite `--with-rtk`, `--only=…` y `--rollback`.
- **Marca de versión** `<!-- lf-harness X.Y.Z -->` en la primera línea de `plugins/lf/home/CLAUDE.md`.
- `LICENSE` MIT en la raíz y `LICENSE-agent-skills` también en `opencode-lf/`.

### Cambiado

- **Instalador dentro del plugin.** `install.sh`, `merge-settings.sh`, `prune-gsd-hooks.sh`, `gsd-surface.cjs` y `home/` pasan a `plugins/lf/`. `scripts/install.sh` en la raíz queda como envoltorio de una línea.
- `install.sh`: sin TTY y sin ser root no llama a `sudo`; avisa con el comando exacto (`sudo apt-get install -y bubblewrap socat`) y continúa. El resumen final muestra `/plugin marketplace add Lf-SergioDominguez/lf-holder`.
- Hook `check-drift.sh` (`SessionStart`): avisa si `~/.claude/CLAUDE.md` no tiene la marca («Arnés LF sin configurar») o no coincide con la versión del plugin («Arnés LF actualizado a X»), y el aviso de GSD apunta a `/lf:setup --only=gsd`. `scripts/test-hooks.sh` cubre los casos nuevos.
- `settings.lf.json`: `extraKnownMarketplaces.lefebvriano-holder` apuntando a `Lf-SergioDominguez/lf-holder`.
- Marketplace en `Lf-SergioDominguez/lf-holder` (el nombre `lefebvriano-holder` y la clave `lf@lefebvriano-holder` no cambian). Licencia `MIT` en `plugin.json`.

### Documentación

- README, ONBOARDING, CONTRIBUTING, plugin y `opencode-lf` con la instalación en tres pasos y las rutas nuevas. `docs/DECISIONS.md`: decisión «Instalador dentro del plugin» (2026-10-13).
- Resultados de rendimiento expresados en porcentajes relativos; sin importes, sin datos de personas y sin mediciones locales. `metrics/` pasa a ignorarse por completo.

## [0.3.0] — 2026-10-08

RTK pasa a opcional y las cifras de rendimiento se recalculan con los datos de octubre. Sin migraciones: quien ya tenga RTK instalado conserva su hook hasta ejecutar `rtk init -g --uninstall`.

### Cambiado

- **Sandbox sin falsos bloqueos.** `.git`, `node_modules`, `vendor`, `var/cache`, `dist`, `public/build` y `coverage` salen de `permissions.deny` en `home/settings.lf.json`: el sandbox los convertía en `denyRead` para los procesos hijos y rompía `tsc`, `astro check`, `npx`, `php bin/console` y `git`. Siguen denegados logs, `.cache`, `.env*.local` y credenciales.
- **Commit y push siempre del usuario.** `git commit*` y `git push*` pasan a `ask`; `git commit --amend*`, `git rebase*` y `gh pr create/merge*` siguen en `deny`. Reglas §9 y §10 de `home/CLAUDE.md` y `opencode-lf/AGENTS.md` reescritas; README, ONBOARDING y DECISIONS (puntos 6, 8 y 9) alineados.
- `project-templates/planning-config.json`: `planning.commit_docs: false` y `parallelization.enabled: false`, para que cada commit de GSD pase por `ask` en primer plano.

### RTK opcional

- **RTK desactivado por defecto.** Prueba A/B del 2 al 8 de octubre sin RTK: mismo coste por petición con Sonnet (variación 0 %) y contexto por petición con Sonnet de 62K a 64K; en la v0.2 RTK ahorraba ~0,14 % del volumen de cache read y oculta líneas de salida.
- `scripts/install.sh`: por defecto solo `deps,claude-md,settings,gsd`. Nueva opción `--with-rtk`; `--only=rtk` sigue funcionando y `--yes` no lo activa. El paso `rtk` fusiona `home/settings.rtk.json` antes de `rtk init`, y el directorio `~/.local/share/rtk` solo se crea ahí.
- `home/settings.lf.json` sin el hook `rtk hook claude`, sin `Bash(rtk *)` y sin `~/.local/share/rtk` en `sandbox.filesystem.allowWrite`. Nuevo `home/settings.rtk.json` con esos permisos.

### Documentación

- README, PRESENTATION y docs con las cifras de octubre y una columna «v0.2 sin RTK» (2–8 oct). Periodos recalculados por día real; cifra estable: coste por petición −57 % respecto a la base. Se retira el «−81 % de coste por día», medido a mediodía del 1 oct con datos parciales.
- `docs/DECISIONS.md`: nueva decisión «RTK opcional» (2026-10-08). ONBOARDING y ERRORES-COMUNES alineados.
- `CLAUDE.md` global: 4,2K (antes 2,1K) en las tablas del equipo.

## [0.2.0] — 2026-09-29

Política de modelos, higiene de contexto y atajos de trabajo. Rompe por dentro solo en el sentido de que las reglas globales se reescriben como índice: no hay migraciones ni cambios de API.

### Modelo y contexto

- **Fable prohibido.** Solo Sonnet, Opus y Haiku. Opus planifica (modo Plan), Sonnet ejecuta, Haiku para el ruido.
- `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5` como modelo por defecto de subagente, además del `model:` por definición.
- `autoCompactWindow: 200000` pasa de estrategia a red de seguridad: la regla es no compactar.
- Reglas `deny` de lectura para logs, `vendor/`, `node_modules/`, `dist/`, `public/build/`, `.git/` y cachés.
- MCP por sesión: solo los que la tarea necesita, revisados al cerrarla.
- Reglas globales (`home/CLAUDE.md`, `opencode-lf/AGENTS.md`) reescritas como índice: política de modelos, higiene de contexto, subagentes vs agent teams, errores que no se cometen, índice de documentación.

### Comandos y agentes nuevos

- `/lf:opusplan` (Opus planifica → Sonnet ejecuta), `/lf:ultrathink` (un turno a xhigh), `/lf:ultracode` (sesión entera a xhigh y multiagente), `/lf:handoff` (handoff.md / to-do.md).
- Agentes `planner` (opus) y `executor` (sonnet) para el ciclo plan-hito sin agent teams.
- Skill `prompting` (manual, coste 0): seis reglas, tabla de fallos típicos y checklist para revisar el arnés.
- Plantillas `docs/templates/handoff.md` y `docs/templates/todo.md`.

### Documentación

- `docs/MODELOS.md` (modelos, esfuerzo, caché, `autoCompactWindow`).
- `docs/PROMPTING.md` (prácticas de prompting y cómo revisar las instrucciones del arnés).
- `docs/ERRORES-COMUNES.md` (los seis errores caros y checklist diaria).
- README, ONBOARDING, DECISIONS y el README del plugin actualizados; la sección 3 del README pasa a describir la política de modelos.

### OpenCode

- `command/` → `commands/` y `agent/` → `agents/`: los directorios reales de OpenCode eran en plural, así que las órdenes y los agentes no se estaban cargando.
- `package.json` mínimo para que las dependencias del plugin se instalen al arrancar.
- `opencode.json`: modelos por agente, `read` con globs en `deny` para secretos y basura, `reasoningEffort` en `plan`.
- `plugins/lf.ts`: hook `experimental.session.compacting` que inyecta en la compactación lo que el arnés no quiere que se pierda (decisiones, enfoques descartados, ficheros modificados) y avisa de escribir el handoff.
- Comandos `opusplan`, `ultrathink`, `ultracode`, `handoff`; agentes `planner` y `executor`.

## [0.1.0] — 2026-09-18

Primera versión desplegada y verificada en una máquina (WSL2, Ubuntu 24.04, Claude Code 2.1.276).

### Plugin `lf`

- Skills de flujo: `triage`, `s`, `m`, `l` (L delega en GSD).
- Skills de stack cargadas por `paths`: `symfony`, `wordpress`, `frontend-astro-vue-react`, `mysql-doctrine`.
- `seo-audit` (auditoría SEO/WPO/a11y en contexto aparte) con 7 ficheros de conocimiento.
- 6 skills adaptadas de addyosmani/agent-skills (MIT): debugging, code review, API design, incremental implementation, security, performance.
- Agentes `verbose-runner` (haiku) y `reviewer` (sonnet).
- Hooks `filter-output` (PreToolUse Bash), `log-permission` (PermissionRequest), `check-drift` (SessionStart).

### Instalador y configuración global

- `scripts/install.sh` idempotente con `--dry-run`, `--only`, `--no-sandbox`, `--rollback`.
- Fusión de settings (`merge-settings.sh`), poda de hooks GSD (`prune-gsd-hooks.sh`), perfil `core` de GSD sin sesión (`gsd-surface.cjs`).
- RTK 0.49.0 con hook global (`--hook-only --auto-patch`).
- Sandbox en WSL2: `enableWeakerNestedSandbox`, cachés en `allowWrite`, `blockReadsOutsideWorkingDirectories: false`, secretos en `deny`.
- `autoCompactWindow: 200000` (Sonnet 5 corre siempre con 1M).

### Medición

- `scripts/measure.sh` sobre transcripts locales; línea base en `metrics/baseline/`.
