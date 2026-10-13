# Decisiones de diseño — lefebvriano-holder

Registro de por qué el arnés es como es. Añade una entrada por decisión relevante (fecha, decisión, motivo, alternativa descartada).

## 2026-09-15 — Diagnóstico inicial

Medición sobre los transcripts locales de un desarrollador (agosto–septiembre 2026, mayoritariamente Sonnet 5):

| Métrica                                                        | Valor                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Volumen que son lecturas de caché (contexto releído por turno) | 97 %                                                                        |
| Contexto medio por turno (cache_read / turno)                  | ~263K tokens                                                                |
| Turnos por sesión                                              | ~124                                                                        |
| Overhead fijo del system prompt                                | ~7–8K tokens (72 skills + 71 agentes de GSD, agente SEO, instrucciones git) |

Conclusión: el gasto no lo dominan las salidas de Bash sino **el tamaño del contexto por turno y el número de turnos por tarea**. Por eso el arnés ataca primero la política de trabajo (S/M/L, sesiones cortas, un subagente barato para lo verboso) y la superficie siempre activa, y solo después la compresión de salidas.

## 2026-09-15 — Decisiones

1. **Marketplace + plugin `lf` + `install.sh`**, no symlinks a `~/.claude`. GSD reescribe `skills/`, `agents/`, `hooks/` y `settings.json`; el plugin vive en su propia caché y sobrevive. Lo que un plugin no puede aportar (settings de usuario, CLAUDE.md global, RTK, poda de GSD) lo hace `install.sh` con backups (desde 0.4.0 va dentro del plugin y se lanza con `/lf:setup`; ver la entrada del 2026-10-13).
2. **GSD se conserva pero recortado** a perfil `core` y un único hook (`gsd-write-guard`). Es excelente para tareas L/XL y excesivo para el resto. El flujo `lf:l` delega en él en vez de reimplementarlo. Descartado: desinstalarlo.
3. **Smith (ATTCKDigital) descartado**: 53 estrellas, sustituye `~/.claude/CLAUDE.md`, hook Stop que re-puntúa cada turno con Haiku y reintenta hasta 3 veces (multiplicador de tokens), gate que deniega ediciones fuera de un workflow. La idea útil (contrato antes de codificar) está en el flujo M y en `lf:l`.
4. **agent-skills (Addy Osmani) vendorizado, no instalado como plugin**: 25 descripciones + 9 comandos + 4 agentes siempre visibles desbordan el presupuesto de listado de skills (1 % del contexto). Se copian 6 skills recortadas con notas para nuestro stack (MIT, licencia incluida).
5. **RTK instalado y medido**, no asumido. Benchmarks independientes (JetBrains, Quesma) muestran ~0 % de ahorro neto en tareas cortas aunque recorte 60–90 % de la salida Bash. En sesiones largas sí frena el crecimiento del contexto. Sus huecos (Symfony console, Astro/Vite, `docker compose exec`) los cubre el hook `filter-output.sh`. **Revisada el 2026-10-08: RTK pasa a opcional**, ver la entrada de esa fecha.
6. **Permisos sin modo `auto`**: `acceptEdits` + sandbox (`autoAllowBashIfSandboxed`) + allowlist del stack + `ask` para commit/push/migraciones/`composer update` + `deny` para PR, `--amend`, rebase, resets, borrados y DDL/DML destructivo. Fallback sin sandbox: `dontAsk`.
7. **Modelo por defecto `claude-sonnet` sin `[1m]`**. La ventana de 1M retrasa la autocompactación y permite sesiones que releen cientos de miles de tokens por turno. Opus solo para planificar tareas L (`/model` a mano). Ver la decisión del 2026-09-29 sobre Fable.
8. **`git commit` y `git push` en `ask`** (2026-10-01): commit, push y PR los decide siempre el usuario. GSD comitea por tarea en L, así que cada commit pasa por `ask`; en la plantilla `planning-config.json` van `commit_docs: false` y `parallelization.enabled: false` (un subagente en segundo plano no puede mostrar el aviso). En S/M no se comitea salvo petición.
9. **Lectura denegada solo para secretos y logs** (2026-10-01): `.git`, `node_modules`, `vendor`, `var/cache`, `dist`, `public/build` y `coverage` salen de `permissions.deny`. El sandbox convierte esas reglas en `denyRead` para los procesos hijos y rompía `tsc`, `php bin/console`, `npx` y `git`. «No leer `vendor/`» queda como norma de comportamiento en CLAUDE.md.
9. **Sin agentes por stack** (`backend-symfony`, etc.): un agente relee el código en contexto nuevo y suma descripción siempre activa. El conocimiento de stack va en skills con `paths`, que cuestan cero hasta tocar ficheros que casen. Solo dos agentes, ambos sumideros de tokens: `verbose-runner` (haiku) y `reviewer` (sonnet).
10. **Línea base antes de desplegar** (2–3 días) para poder demostrar el objetivo de −60 % con `scripts/measure.sh`.

## 2026-09-18 — Sandbox en WSL2 requiere `enableWeakerNestedSandbox`

Decisión: `sandbox.enableWeakerNestedSandbox: true` en el fragmento global.
Motivo: en WSL2 (Ubuntu 24.04, usuario root) el filtro seccomp embebido en Claude Code falla con `apply-seccomp: write /proc/self/uid_map: Operation not permitted` aunque `bwrap --unshare-user` funciona a mano. Con el modo anidado débil el sandbox arranca y sigue bloqueando escrituras fuera del proyecto (verificado: `touch /etc/x` → read-only). Se pierde el bloqueo de sockets Unix y el `/proc` fresco; aceptable porque el aislamiento fuerte no era el objetivo, sino auto-aprobar Bash sin prompts.
Alternativa descartada: `--no-sandbox` + `dontAsk` (queda como fallback en `install.sh`).

## 2026-09-18 — `blockReadsOutsideWorkingDirectories` rompe el stack dentro del sandbox

Decisión: `permissions.blockReadsOutsideWorkingDirectories: false`; secretos protegidos con `permissions.deny Read(~/.ssh/**)`, `~/.claude/.credentials.json`, `~/.config/gh/hosts.yml` (el sandbox replica esas denegaciones; **un directorio denegado que no existe rompe bwrap**, por eso no se listan `~/.aws` ni `~/.gnupg` y `install.sh` crea `~/.ssh` si falta); `git` y `gh` en `sandbox.excludedCommands` para que usen la clave SSH y el token bajo las reglas allow/ask/deny.
Motivo: con esa clave activa (venía de GSD) el sandbox oculta todo `/root`: `node` cae a la v18 del sistema en vez de la v24 de nvm, `bun` y `rtk` no existen, composer pierde la caché. Verificado el 2026-09-18.
Alternativa descartada: `sandbox.filesystem.allowRead` con la lista de directorios de herramientas (frágil: cada herramienta nueva rompe).

## 2026-09-18 — Cachés escribibles dentro del sandbox

Decisión: `sandbox.filesystem.allowWrite: ["~/.npm", "~/.cache", "~/.bun", "~/.config/composer", "~/.local/share/rtk"]`; `install.sh` crea los directorios si faltan. Desde el 2026-10-08 `~/.local/share/rtk` va en `home/settings.rtk.json` y solo se añade al instalar RTK.
Motivo: por defecto el sandbox solo permite escribir en el proyecto y `$TMPDIR`; `npm install`, `composer install` y `bun install` fallarían al escribir su caché y provocarían el reintento fuera del sandbox (un prompt cada vez). `rtk` guarda su base de datos de ahorro en `~/.local/share/rtk`.

## 2026-09-18 — Sonnet 5 siempre corre con 1M: hay que fijar `autoCompactWindow`

Decisión: `autoCompactWindow: 200000` en el fragmento global. Para una tarea L larga: `/autocompact 600k` en la sesión (lo guarda en user settings; volver con `/autocompact 200k`) o `claude --autocompact 600000` para un solo arranque.
Motivo: quitar el sufijo `[1m]` no cambia nada en Sonnet 5: en la API de Anthropic siempre tiene ventana de 1M y no existe variante de 200K; compacta a ~967K por defecto. Sin tope, una sesión larga relee cientos de miles de tokens por turno (línea base: 268K/turno). Con 200K el coste por turno queda acotado; la compactación cuesta una petición completa, pero el `/clear` por tarea del flujo S/M la evita casi siempre.
Alternativa descartada: `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` (bloquea también Fable/Opus para L) y `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (env: no se puede subir por sesión con `/autocompact`).

## Plantilla de entrada

```text
## AAAA-MM-DD — <título>
Decisión: …
Motivo: …
Alternativa descartada: …
```

## 2026-09-29 — Modelo, contexto y prompting de la v0.2.0

1. **Fable queda prohibido.** Solo Sonnet, Opus y Haiku. No es la mejor relación calidad/precio de la gama y el arnés no lo usa en ningún flujo. Opus planifica (modo Plan), Sonnet ejecuta, Haiku para el ruido. Alternativa descartada: permitirlo como modelo experimental, porque cada regla que se puede incumplir se incumple.
2. **`CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5`** como valor por defecto de cualquier subagente sin modelo propio, además del `model:` explícito en cada definición. Motivo: un subagente sin modelo hereda el de la sesión, que es Opus, y eso es justo el gasto que se quiere evitar. El `model:` por agente manda sobre la variable.
3. **Prohibido compactar por sistema.** La compactación automática cuesta una petición completa y pierde lo que no se le pide: un enfoque que ya falló, una decisión descartada. Sustituto: `/lf:handoff` (handoff.md / to-do.md con plantilla) al 75–80 % y `/clear`. `autoCompactWindow: 200000` se mantiene como red de seguridad, no como estrategia. Alternativa descartada: subir la ventana a 600K con `/autocompact`, que solo retrasa el problema y multiplica el coste por turno.
4. **El cache se paga por cambio de modelo.** Por eso `/lf:opusplan` (Opus y Sonnet en la misma sesión) se documenta como atajo cómodo y el flujo de dos sesiones como recomendado. Además, `ultrathink` (un turno a xhigh) frente a `ultracode` (sesión entera a xhigh): son problemas distintos y confundirlos cuesta una sesión cara para una sola pregunta.
5. **Reglas `deny` de lectura para logs y artefactos** (`*.log`, `var/log`, `vendor/`, `node_modules/`, `dist/`, `.git/`). Motivo: no llegar a leerlos es más barato que filtrar después. Se leen con `grep` por Bash, que sigue permitido. Alternativa descartada: un hook que avise, porque un hook que imprime en cada llamada es ruido.
6. **Agentes `planner` (opus) y `executor` (sonnet)** en lugar de agent teams. Un equipo de agentes, según estimaciones, sale en torno a 7× más caro en tokens que una sesión normal y acorta la ventana de trabajo de horas a minutos; dos subagentes en cadena dan la misma separación de contexto por una fracción del coste. Ejecutores **en serie**, uno por hito: dos agentes escribiendo en el mismo árbol se pisan.
7. **MCP por sesión.** Habilitar solo los que la sesión va a usar, y revisarlos al cerrarla. Cada MCP añade definiciones al contexto fijo de todas las sesiones.
8. **`AGENTS.md` como opción compatible globalmente**, y por defecto para Claude Code. Un fichero de ~200 líneas que funciona como índice rinde más que uno extenso: lo específico va en skills, plantillas o docs, y desde ahí se enlaza.

## 2026-10-08 — RTK opcional (v0.3.0)

Decisión: RTK deja de instalarse por defecto. `install.sh` ejecuta `deps,claude-md,settings,gsd`; RTK se añade con `--with-rtk` o `--only=rtk` (`--yes` no lo activa). El hook `rtk hook claude`, `Bash(rtk *)` y `~/.local/share/rtk` salen de `plugins/lf/home/settings.lf.json` y viven en `plugins/lf/home/settings.rtk.json`, que el paso `rtk` fusiona con `merge-settings.sh`. No se borra del repo: puede seguir siendo útil en sesiones L largas.
Motivo: prueba A/B de una semana sin RTK (2–8 oct, mediciones locales) frente a la v0.2 con RTK (29 sep–1 oct). Con Sonnet, el coste por petición fue idéntico (variación 0 %) y el contexto por petición pasó de 62K a 64K. En la v0.2 RTK ahorraba ~0,14 % del volumen de cache read. Además oculta líneas de salida (`[+N hidden: rtk recall …]`), lo que provoca turnos a ciegas. El contexto fijo no cambió (21,0–21,1K en `/context` del 5, 6 y 8 oct).
Salvedades: la semana sin RTK fue también la primera con el flujo L en uso real (`lf:executor`, `gsd-executor`, `lf:reviewer` en Sonnet; `lf:planner`/`gsd-planner` en Opus), así que el coste por día (de −58 % a −3 % respecto a la base) y el reparto de modelos (Opus del 34 % al 56 % del coste, Haiku del 22 % al 5 % de las peticiones) no son atribuibles a RTK. Una persona, 3 + 5 días.
Corrección de cifras: el «−81 % de coste por día» publicado antes se midió a mediodía del 1 oct con datos parciales y no se sostiene. La cifra estable es el coste por petición: −57 % respecto a la base.
Alternativa descartada: quitar RTK del repo. Nota: `merge-settings.sh` une entradas y nunca borra, así que quien ya lo tenga instalado debe quitar a mano el hook de `~/.claude/settings.json` (`rtk init -g --uninstall`).

## 2026-10-13 — Instalador dentro del plugin (v0.4.0)

Decisión: `install.sh`, `merge-settings.sh`, `prune-gsd-hooks.sh`, `gsd-surface.cjs` y `home/` se mueven a `plugins/lf/` y se lanzan con el comando `/lf:setup`. `scripts/install.sh` en la raíz queda como envoltorio de una línea para clones existentes. El marketplace pasa a `Lf-SergioDominguez/lf-holder` (el nombre `lefebvriano-holder` y la clave `lf@lefebvriano-holder` no cambian).
Motivo: solo `plugins/lf/` llega a la caché del plugin, así que el instalador, para ser accesible en `${CLAUDE_PLUGIN_ROOT}`, tiene que vivir ahí. Instalar pasa de «clonar repo + script + marketplace» a tres comandos sin clonar y sin credenciales de Git (el repo es público).
Consecuencias: (1) `sudo` para `bubblewrap` y `socat` no puede pedir contraseña desde Claude; el instalador sin TTY muestra el comando exacto y sigue. (2) El plugin no puede fijar settings por sí mismo: `/lf:setup` los fusiona en `~/.claude`, fuera del sandbox y con permiso del usuario. (3) El hook `check-drift` compara la marca `<!-- lf-harness X.Y.Z -->` de la primera línea de `~/.claude/CLAUDE.md` con la versión del plugin y avisa en una línea si falta o difiere.
Alternativa descartada: que el hook `SessionStart` aplique los settings solo; escribir en `~/.claude` sin que el usuario lo vea rompe la regla de que lo global lo decide siempre la persona.

## 2026-10-13 — Guardia de lectura por hook y caveman opt-in (v0.5.0)

Decisión: (1) la lectura de `vendor/`, `node_modules/`, `.git/`, `var/cache/`, `dist/`, `public/build/`, `coverage/`, minificados, source maps y lockfiles, y de ficheros de más de 800 líneas o 300 KB sin `offset`/`limit`, se bloquea con el hook `guard-read.sh` (`PreToolUse` sobre `Read`), no con `permissions.deny`. (2) El modo de salida telegráfica se ofrece como `/lf:caveman [lite|full|off]` y como output style `caveman`, siempre opt-in. `filter-output.sh` acepta además un único prefijo `cd <ruta> && ` y escribe su log por sesión.
Motivo: (1) el sandbox convierte las reglas `deny` de lectura en `denyRead` para los procesos hijos y rompía `tsc`, `composer`, `php bin/console` y `git` (ver la decisión 9 del 2026-09-15). Un hook solo ve las llamadas a la herramienta `Read` del agente, no las de los procesos, así que da el mismo ahorro sin ese efecto, y explica qué hacer en su lugar. Solo habla cuando deniega, por lo que no cae en el «ruido en cada llamada» que motivó descartar un hook en la decisión 5 del 2026-09-29. (2) Comprimir por defecto puede perder matices en revisiones, planes y avisos; como opción de sesión, la persona decide cuándo le compensa.
Alternativa descartada: volver a `permissions.deny` para esas rutas (rompe el sandbox) y activar caveman en `settings.lf.json` (`outputStyle`).
