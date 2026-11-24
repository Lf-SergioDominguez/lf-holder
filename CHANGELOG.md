# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Versionado semántico; la versión vive en `.claude-plugin/marketplace.json` y `plugins/lf/.claude-plugin/plugin.json`.

## [Unreleased]

### Eliminado

- GSD sale del flujo del arnés (ADR 0024, sustituye a la 0014): hook `gsd-one-per-session.sh`, scripts `gsd-lean.sh`, `prune-gsd-hooks.sh` y `gsd-surface.cjs`, plantilla `planning-config.json`, paso `gsd` de `install.sh` (`--only=gsd` se ignora con aviso), `optional.gsd` de `config.json` y los avisos de GSD de `session-start.sh`. No se desinstala GSD a nadie.

### Cambiado

- `lf:l` ejecuta los hitos sin GSD: un hito por sesión con `lf:planner` (solo si hay zonas grises), `lf:executor` en Sonnet y `lf:reviewer`, con el estado en `.planning/STATE.md`. Sin `config.json` ni `PROJECT.md`. En L tampoco hay commits automáticos.
- `/lf:setup` ya no ofrece la poda de GSD.
- `docs/VISION.md`: nuevo hito H7 (auditoría de quality gates).

### Corregido

- El autocompact se cruzaba con el handoff: Claude Code compacta hacia `autoCompactWindow − ~33K`, no al 100 % de la ventana, y un proyecto con `autoCompactWindow: 200000` compactaba a ~167K. `autoCompactWindow` pasa a 253000 (el autocompact salta hacia los 220K) y la statusline mide sobre el límite de trabajo de 200K (amarillo 75 %, rojo 80 %); lee el valor efectivo (proyecto local > proyecto > usuario) y, si fija una ventana menor, mide sobre ese umbral real. `session-start` avisa si el valor efectivo es <253000 (ADR 0021, addenda).

### Añadido

- H1 de la hoja de ruta: `/lf:setup` guiado con perfiles. Pregunta perfil de equipo, telemetría sí/no (solo guarda la elección; el envío llega con H2) y opcionales; `install.sh` gana el paso `config` y los flags `--profile=`, `--telemetry=` y `--telemetry-every=weekly|month-ends|monthly`, y guarda las elecciones en `~/.claude/lf/config.json` (los perfiles se copian a `~/.claude/lf/profiles/`). Perfiles iniciales: `web` y `generic` en `plugins/lf/profiles/` (ADR 0022).
- `docs/VISION.md`: definición, declaración de intenciones y hoja de ruta hacia 1.1.0 (telemetría opt-in, `/lf:setup` guiado con perfiles, quality gates, evals reales y bucle de automejora).

## [1.0.2] — 2026-11-20

Ficheros de comunidad para quien usa el arnés.

### Añadido

- `SECURITY.md`: versiones soportadas, alcance (bypass de `bash-gate`, escape del sandbox, inyección en hooks y scripts, fuga de secretos) y reporte privado de vulnerabilidades de GitHub.
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) y `SUPPORT.md` (Discussions e Issues).
- Formularios de issue (*Bug*, *Mejora*) en `.github/ISSUE_TEMPLATE/`; los issues en blanco quedan desactivados.
- `docs/CONTRIBUTING.md`: el repo es una réplica sin pull requests; errores y propuestas por issue o discusión.

## [1.0.1] — 2026-11-17

Cierra el hito 4 (release y evals) y da margen al contexto para que el handoff quepa antes del autocompact.

### Añadido

- **Statusline de contexto** (ADR 0021): `ctx 142k/200k 71%` siempre visible, gris por debajo del 75 %, amarillo desde el 75 % y rojo con «→ /lf:handoff» desde el 80 %. `install.sh` la copia a `~/.claude/lf/statusline.sh`, `merge-settings.sh` no pisa una `statusLine` ajena y `LF_CTX_LIMIT` ajusta el límite. Hace falta `/lf:setup` para recibirla.
- **Flujo de release** (ADR 0019): `scripts/release.sh` comprueba que las versiones coinciden (ambos manifiestos, marca de `home/CLAUDE.md` y CHANGELOG), `claude plugin validate --strict`, `test-hooks.sh` y `claude plugin tag --dry-run`; con `--evals` añade la suite (tope 5 USD). No crea el tag ni hace push.
- **Plugin evals** en `plugins/lf/evals/`: cinco casos (`/lf:handoff`, `/lf:s`, `/lf:m`, `/lf:triage` y uno negativo) con baseline sin plugin. Última pasada: con plugin 1.00 en los cinco; Δ medio +0,46 (+1,00 / +0,50 / +0,29 / +0,50 / 0,00). Corren sin el CLAUDE.md global, así que miden lo que aporta el plugin; las reglas de permisos las cubren `tests/gate-cases.tsv` y `test-hooks.sh`.
- `docs/CONTRIBUTING.md`: desarrollo local (`--plugin-dir` y `/reload-plugins`), evals y release. ADR 0021 (índice 0001–0021).

### Cambiado

- `autoCompactWindow` pasa de 200000 a **220000**: el límite de trabajo sigue en 200K y los 20K de margen hacen que el handoff quepa antes del autocompact (Sonnet 5 corre con ventana de 1M, ADR 0006). Con `/autocompact` se ajusta por sesión.
- La regla del handoff en `home/CLAUDE.md` pasa a «al 75–80 % de contexto (sobre 200K; la statusline lo marca)»; `MODELOS.md` y `ONBOARDING.md` actualizados.
- `plugins/lf/evals/results/` queda en `.gitignore` (informes con rutas y costes locales).

### Corregido

- `plugin.json` y la marca de `home/CLAUDE.md` se quedaron en 0.9.0 en la 1.0.0 mientras `marketplace.json` decía 1.0.0: vuelven a coincidir en 1.0.1, sin lo cual el plugin no se actualiza para quien lo recibe por el marketplace.

### Conocido

- Sin validar en sesión real: `/lf:dream`, PreCompact y la expansión de `${CLAUDE_PLUGIN_ROOT}` en skills con `context: fork`. La statusline solo se ha probado con entradas simuladas del JSON documentado.

## [1.0.0] — 2026-11-17

Primera versión estable. Reúne los cuatro frentes del plan 0.11 (permisos, tokens, memoria, house style). Versión mínima de Claude Code: 2.1.295.

### Añadido

- Hook `bash-gate` (PreToolUse): clasifica el comando completo y decide `allow|ask|deny` (`LF_GATE=on|shadow|off`, por defecto `on`). Quita el `cd <cwd> &&` redundante y, ante un error interno, pregunta. `DELETE/DROP/TRUNCATE` → `deny` (lo lanza el usuario con `! …`), escrituras SQL y `rm` de ficheros del repo o de `$TMPDIR` → `ask`, borrado recursivo sobre raíz, home o fuera del repo → `deny`. Detalle en `plugins/lf/docs/PERMISOS.md` y ADR 0017.
- `sandbox.excludedCommands` solo para binarios que no ejecutan código del repo (`docker`, `mysql`, `mariadb`, `gh`, git de red, `curl` a localhost) y perfil `home/settings.nosandbox.json` para `--no-sandbox` y Windows nativo.
- `merge-settings.sh --prune` con manifiesto `~/.claude/lf/managed.json` y `home/managed-legacy.json`: las bajas de reglas llegan a quien ya había instalado.
- **`/lf:dream`** y `scripts/dream-digest.mjs`: consolida la memoria entre sesiones (corregir, estructurar, promover, enfocar) a partir de un digest sin tokens, con copia previa `.prev.tgz`, enmascarado de credenciales y presupuestos (nota ≤30 líneas, `MEMORY.md` ≤60, `USER.md` ≤40). Manual, con aviso en SessionStart (ADR 0018).
- Hook `PreCompact` (`precompact.sh`) con las instrucciones de qué conservar si se compacta a mano, y avisos de SessionStart cuando hay `handoff.md` en el cwd o ≥5 sesiones (o ≥7 días) sin consolidar.
- Memoria de usuario `~/.claude/lf/memory/USER.md`, importada desde el CLAUDE.md global; `install.sh` la crea sin sobrescribirla. Docs `MEMORIA.md` y `PERMISOS.md`.
- **House style corporativo de serie** (Lefebvre 2026) en `plugins/lf/house-style/`, instalado por `/lf:setup` en `~/.claude/lf/house-style/` y consultado por el CLAUDE.md global y `lf:frontend-astro-vue-react`. **`/lf:house-style [carpeta|.md|--reset]`** lo sustituye por otro; un destino `.custom` no lo pisa `/lf:setup`. Azul España `#001978` (`--lf-brand-spain`) como excepción de identidad de sucursal (ADR 0020).
- `Hecho cuando: <comprobación ejecutable>` en el contrato M y en la entrega S/M, y bloque «Cómo pedir permisos sin fricción» en el CLAUDE.md global.
- Docs que viajan con el plugin (`plugins/lf/docs/`, copiadas a `~/.claude/lf/docs/`) y plantillas de handoff y to-do en `plugins/lf/templates/`.
- Auto-actualización del plugin: `FORCE_AUTOUPDATE_PLUGINS=1` y `autoUpdate` en `lefebvriano-holder`.
- `docs/decisions/` con un ADR por fichero (0001–0020) y su índice.

### Cambiado

- `home/CLAUDE.md` pasa de 128 a 63 líneas: el stack detallado queda solo en las skills con `paths:` y los docs se leen bajo demanda.
- Concisión por defecto: output style `Concise`, esfuerzo `medium` por modelo (`modelSettings`), `idleCompaction: false`, `skillListingMaxDescChars: 150`. `caveman` se reduce a `full|off`.
- Las lecturas peligrosas pasan de `deny Read(...)` (que el sandbox convertía en `denyRead` y rompía la app) a `guard-read.sh`; en `deny` solo quedan las credenciales.
- `trim-output.mjs` sustituye a `filter-output.sh`: avisa siempre de lo omitido y deja la salida completa en `$TMPDIR`.
- Agentes: `lf:planner` en `effort: high`; `lf:executor` y `lf:reviewer` en `medium`. `setup`, `ultracode` y `opusplan` con `disable-model-invocation`; `s`, `m` y `triage` quedan en stubs de ≤6 líneas. Descripciones de skills y agentes ≤120 caracteres.
- `docs/DECISIONS.md` se trocea en `docs/decisions/`; el README raíz baja a ≤90 líneas; las docs de OpenCode pasan a `opencode-lf/docs/`; `docs/ONBOARDING.md` exige `node` ≥22.
- `plugin.json` y `marketplace.json` vuelven a coincidir: el desfase (0.9.0 frente a 0.10.0) impedía que nadie recibiera la 0.10.0.

### Eliminado

- **RTK** (ADR 0016): `commands/rtk.md`, `scripts/rtk.sh`, `home/settings.rtk.json` y los flags `--with-rtk`/`--only=rtk`. `install.sh` quita `@RTK.md` del CLAUDE.md global y `--prune` retira `Bash(rtk *)` y el hook `rtk hook claude`. El binario `rtk` hay que desinstalarlo a mano.
- `commands/ultrathink.md` (la palabra `ultrathink` ya es nativa) y `hooks/filter-output.sh`.

### Corregido

- Los dry-run ya no preguntan: el gate los deja pasar.
- `docs/DECISIONS.md`: doble «9», «solo dos agentes», `lf:reviewer` en Sonnet y `excludedCommands` desfasados.
- `PROMPTING.md` y `ERRORES-COMUNES.md` vuelven a ser los de Claude Code (los de OpenCode viven en `opencode-lf/docs/`).

### Conocido

- El gate es una barandilla, no una frontera de seguridad: `grep -rn X .` puede leer `.env.local`, y `trim-output` no recorta la salida de comandos que fallan.
- Pendiente del hito 4: `scripts/release.sh`, evals (`claude plugin eval`) y validación real de `/lf:dream`, PreCompact y la expansión de `${CLAUDE_PLUGIN_ROOT}` en skills con `context: fork`.

## [0.10.0] — 2026-11-17

### Añadido

- Plugin **Modern Web Guidance** de Google (`modern-web-guidance@googlechrome`) activo por defecto, con el marketplace `googlechrome` en `autoUpdate`. Llega a `~/.claude/settings.json` con `/lf:setup`.
- Integración en el arnés: una línea en §8 del CLAUDE.md global para que el agente la consulte sin que nadie la invoque, y una sección operativa en `lf:frontend-astro-vue-react` (cuándo usarla, encaje con S/M/L, Baseline, `legacy-scan` y entrega). Referencias de una línea en `wordpress`, `performance-optimization`, `security-and-hardening` y `seo-audit`.
- Permisos solo para los subcomandos de lectura del CLI (`search`, `retrieve`, `list` y `legacy-scan`, con `npx -y` y con `pnpx`), y `DISABLE_TELEMETRY=1` en `env` para que el CLI no envíe consultas a Google.
- Sección «Navegadores» (objetivo de Baseline) en `project-templates/CLAUDE.md`.

## [0.9.0] — 2026-11-05

### Cambiado

- GSD en modo barato. Encadenar plan y execute en la misma sesión (`auto_advance`) provocaba varias compactaciones, y `gsd-planner` corría en Opus en un bucle de hasta 3 revisiones con `gsd-plan-checker`: era el grueso del coste de las tareas L.
- `planning-config.json` se mueve de `project-templates/` a `plugins/lf/templates/`: la caché del plugin no incluía `project-templates/`, así que `lf:l` no encontraba la plantilla en instalaciones reales. Valores nuevos: `model_profile: budget` (planner y executor en Sonnet), `plan_check: false`, `auto_advance: false`, `ui_phase: false`, `post_planning_gaps: false`, `context_guard_mode: auto` (pausa en vez de compactar) y `compact_content: true`.
- `lf:l` ya no lanza `gsd-plan-phase` ni `gsd-execute-phase`: deja escrita la siguiente orden, que se ejecuta en una sesión nueva en Sonnet. Las fases con más de 4 planes se ejecutan una oleada por sesión (`--wave N`).

### Añadido

- Hook `gsd-one-per-session.sh` (UserPromptSubmit y PreToolUse de Skill): bloquea una segunda orden GSD pesada en la misma sesión y pide `/clear`. Escape: `LF_GSD_ONE_PER_SESSION=0`.
- `plugins/lf/scripts/gsd-lean.sh [dir…]`: crea `.planning/config.json` o impone en el existente solo las claves de coste, sin tocar `mode`, gates ni granularity, e imprime lo que cambia.
- `check-drift.sh` avisa al abrir sesión si el `.planning/config.json` del proyecto está en modo caro.

### Corregido

- El aviso «Arnés LF actualizado a X: ejecuta /lf:setup» salía en cada sesión, incluso después de `/lf:setup`. `home/CLAUDE.md` llevaba fija la marca `<!-- lf-harness 0.5.3 -->` y nunca coincidía con la versión del plugin. Ahora `install.sh` escribe la marca con la versión de `plugin.json`.

## [0.8.0] — 2026-10-26

### Cambiado

- Reajuste a Claude Haiku 5.5: `CLAUDE_CODE_SUBAGENT_MODEL` pasa a `claude-haiku-5-5` (0,10 $ / 0,50 $ por MTok con prompts de hasta 100k tokens, 10 veces menos que Haiku 4.5). Se actualiza en `~/.claude/settings.json` con `/lf:setup`.
- `lf:reviewer` pasa de Sonnet a Haiku, con `effort: high` (antes `medium`). Riesgo asumido: revisiones menos finas; se vigila. `lf:verbose-runner` sigue en Haiku con `effort: low`.
- `docs/MODELOS.md` vuelve a ser la política de Claude Code (Haiku 5.5, umbral de 100k tokens, +30 % de tokens del tokenizador de los modelos 4.7 y posteriores). La política de OpenCode pasa a `opencode-lf/MODELOS.md`.
- `scripts/measure.sh` conoce Haiku 5.5 con dos tramos de precio: por encima de 100k tokens de prompt (input + lectura + escritura de caché) toda la petición paga el tramo largo.

### Corregido

- `scripts/measure.sh` no reconocía los ID con sufijo de fecha (`claude-haiku-4-5-20251001`) y los cobraba al precio `default`, el de Opus: el coste de Haiku salía inflado unas 4 veces. Ahora se normaliza el sufijo `-AAAAMMDD`. Las métricas anteriores del README se calcularon con este fallo.
- `scripts/measure.sh`: la lectura de caché de `claude-sonnet-5-5` figuraba a 0,20 $ por MTok y vale 0,10 $.
- `docs/MODELOS.md` había quedado sobrescrito con la política de OpenCode, y el `CLAUDE.md` global remite a él para la de Claude Code. Se restaura y se corrige una frase corrupta en «La trampa de la caché».

## [0.7.0] — 2026-10-20

### Cambiado

- La poda de GSD en `/lf:setup` ya no se aplica sola: es una opción de la guía (con `install.sh` directo sigue siendo un paso por defecto).

### Añadido

- Paso opcional `taste` en `install.sh` (`--with-taste`, `--only=taste`) y pregunta en `/lf:setup`: habilita el plugin [taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) para diseño anti-slop mediante `home/settings.taste.json` (marketplace + `enabledPlugins`). Solo el plugin principal, no `taste-skill-classics`. Desactivado por defecto: es más pesada que `frontend-design`.
- `/lf:setup` guiado: una pregunta de multiselección con lo opcional (RTK, taste-skill, poda de GSD si está instalado). Sin marcar nada solo se aplica la base. Se construye un `--only=` explícito con las respuestas.
- Comando `/lf:rtk on|off|status` y `scripts/rtk.sh`: activa o retira el hook `rtk hook claude` de `settings.json` con backup; `off` deja el binario y es reversible con `on`.
- `frontend-astro-vue-react` remite a taste-skill, si está habilitada, para diseño anti-slop.

## [0.6.1] — 2026-10-15

### Corregido

- `.gitignore` ignoraba cualquier `handoff.md` del árbol, no solo el de trabajo en la raíz: el repo público se publicó sin `plugins/lf/commands/handoff.md`, `opencode-lf/commands/handoff.md` ni `docs/templates/handoff.md`, y `/lf:handoff` desaparecía al actualizar a 0.6.0. La regla pasa a `/handoff.md`.

## [0.6.0] — 2026-10-15

### Añadido

- Sección §9 «Código mínimo» en `home/CLAUDE.md` y `opencode-lf/AGENTS.md`, destilada de [ponytail](https://github.com/dietrichgebert/ponytail) (MIT): escalera reutilizar → stdlib/dependencia instalada → mínimo, sin saltarse las capas del proyecto; el cambio entero (llamadores, tests, fixtures); test pequeño solo para lógica no trivial; lista de lo que nunca se recorta. «Errores que no cometo» y «Git» pasan a §10 y §11.
- `executor` recibe las mismas reglas en versión compacta (no lee el CLAUDE.md) y una línea `No comprobado:` en su salida.
- `reviewer`: categoría **Lean** ([BAJA]: código muerto, helper ya existente, abstracción con una implementación, casi-duplicados), más casos de correctitud (llamadores rotos, arreglo en un llamador con la función compartida rota, check-then-write) y líneas `Lean: -N líneas posibles` y `No comprobado:`.
- La entrega de los flujos S y M cierra con una línea de lo no comprobado y sus riesgos.
- `LICENSE-ponytail` en `plugins/lf/` y `opencode-lf/`.

## [0.5.3] — 2026-10-13

### Corregido

- `merge-settings.sh` pasa `settings.json` y el fragmento a `jq` por stdin en vez de con `--argjson`: en Windows nativo, un `settings.json` de más de ~32 KB fallaba con *Argument list too long* y bloqueaba `/lf:setup --windows`.

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
