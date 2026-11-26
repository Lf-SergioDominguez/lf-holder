---
description: Configura el arnés LF en ~/.claude (CLAUDE.md, settings, docs) desde el plugin instalado.
argument-hint: "[--with-taste] [--profile=<nombre>] [--telemetry=on|off] [--telemetry-every=weekly|monthly] [--mcp=playwright,github,atlassian,figma] [--only=…] [--no-sandbox] [--windows] [--rollback]"
disable-model-invocation: true
---

Instala o actualiza la parte del arnés que un plugin no puede aportar. Argumentos: `$ARGUMENTS`

## 0a. Comprobar dónde corre la sesión: Linux, macOS, WSL o Windows

Antes de nada ejecuta `uname -s`. Hay Windows nativo si empieza por `MINGW`, `MSYS` o `CYGWIN`. Si `uname` es Linux pero la ruta del plugin o de `~/.claude` es de Windows (`C:/…`, `C:\…`), da el aviso de la opción WSL de abajo y para, sin preguntar. En Linux, macOS o WSL con rutas normales sigue con el paso 0.

En Windows nativo, si `$ARGUMENTS` trae `--windows` o `--rollback`, salta al **modo Windows** (el rollback solo restaura backups). Si no, haz una sola pregunta con AskUserQuestion: «Claude Code está corriendo en Windows, no en WSL. ¿Dónde quieres instalar el arnés?». Opciones:

- **WSL (recomendado)**: sandbox de Bash y el `~/.claude` de WSL. No instales `jq` ni busques WSL por tu cuenta (`wsl.exe`, `\\wsl$`). Explica al usuario, en estas palabras, y **para aquí**:

  > Aunque la ventana de VS Code esté conectada a WSL, la extensión Claude Code está instalada solo en local. Arreglo: Extensiones → Claude Code → **Install in WSL: \<distro\>**; después `Ctrl+Shift+P` → *Developer: Reload Window*; en el panel de Claude, `/plugins` → añade `Lf-SergioDominguez/lf-holder` e instala `lf`; y repite `/lf:setup`.

- **Windows nativo**: sin sandbox, porque en Windows no está soportado. Con `permissions.defaultMode: dontAsk`, Bash solo ejecuta lo que está en la allowlist y deniega el resto sin preguntar. Además, la guardia de lectura puede no bloquear `vendor/` ni `node_modules/` con rutas `C:\…`. Sigue en el **modo Windows**.

**Modo Windows** (Git Bash):

1. Añade `--windows` a `$ARGUMENTS` si no está.
2. Comprueba `command -v jq`. Si falta, no lo instales tú: pide al usuario que ejecute `winget install jqlang.jq` en PowerShell, reinicie VS Code y repita `/lf:setup --windows`, y para. Sin `jq` los hooks del plugin no hacen nada.
3. En el paso 2 no hay sandbox: no hace falta `dangerouslyDisableSandbox`.

## 0. Resolver la ruta del plugin

Usa `${CLAUDE_PLUGIN_ROOT}` si aparece sustituida por una ruta real (absoluta, sin `${`). Si llega literal o vacía, resuélvela así y úsala como `PLUGIN_ROOT` en los pasos siguientes:

```bash
jq -r '.plugins["lf@lefebvriano-holder"][0].installPath // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
```

En modo Windows, convierte `PLUGIN_ROOT` con `cygpath -u "<ruta>"` venga de donde venga (`${CLAUDE_PLUGIN_ROOT}` o `installPath` llegan como `C:\…`, y Git Bash se come las barras invertidas). Después comprueba que `PLUGIN_ROOT/scripts/install.sh` existe.

`$ARGUMENTS` solo admite los flags de `argument-hint` (`--with-taste`, `--profile=<nombre>`, `--telemetry=on|off`, `--telemetry-every=weekly|monthly`, `--mcp=<lista>` (de `playwright`, `github`, `atlassian`, `figma`; vacío la limpia), `--only=<pasos separados por comas>`, `--rollback`, `--no-sandbox`, `--windows`). Si contiene cualquier otra cosa, no ejecutes nada y dilo. Si no existe o `jq` no devuelve nada, para y di que el plugin `lf` no está instalado (`/plugin install lf@lefebvriano-holder`).

## 0b. Guía: perfil, telemetría y opcionales

Siempre se aplican los pasos base: dependencias del sandbox, CLAUDE.md global, settings y config (perfil y elecciones en `~/.claude/lf/config.json`). Salta este paso entero si `$ARGUMENTS` contiene `--only=` o `--rollback`.

Haz **una sola llamada** a AskUserQuestion con estas preguntas, omitiendo las que ya vengan dadas por flag o que no apliquen:

1. **Perfil de equipo** (una opción; omítela si hay `--profile=`). Lista los `PLUGIN_ROOT/profiles/*.md` (nombre y `description` del frontmatter), con `web` primero si existe. Si el usuario ya tiene `~/.claude/lf/config.json`, pon su perfil actual como recomendado.
2. **Telemetría** (omítela si hay `--telemetry=`): «¿Enviar un informe agregado y anónimo para medir y mejorar el arnés?». Opciones, en este orden: **1. No**, **2. Cada semana (Recomendada)** (`weekly`) y **3. Cada mes** (`monthly`); 2–3 activan la telemetría (omite las que contradigan `--telemetry-every=`; este flag sin `--telemetry=` solo guarda la frecuencia). Di en la descripción qué se enviaría: versión, variante, perfil, sesiones, turnos, coste por petición, contexto fijo, % de autocompact y recuentos de `ask`/`deny` y de errores de hooks. Nunca prompts, código, rutas, proyectos ni identificadores de sesión. La issue la abre la cuenta de GitHub de quien envía, así que su usuario sería visible. El setup solo guarda la elección; el informe se previsualiza y se envía con `/lf:telemetry`.
3. **Opcionales** (`multiSelect: true`, «sin marcar ninguno, solo se aplica la base»), uno por pendiente, quitando los dados por flag (`--with-taste`) o ya activos:
   - **taste-skill** (ya activo si `~/.claude/settings.json` tiene `enabledPlugins["taste-skill@taste-skill"]`): skill de diseño anti-slop (dirección artística, imágenes reales, inspector en navegador). Más potente que `frontend-design`, pero más pesada en contexto; el inspector necesita Node 22+ y Chrome/Edge/Chromium. Solo el plugin principal, no `taste-skill-classics`.

4. **MCP opcionales** (`multiSelect: true`; omítela si hay `--mcp=`): «¿Qué MCP quieres montar? Sin marcar ninguno, no se monta ninguno». Una opción por MCP de `PLUGIN_ROOT/docs/MCP.md` (`playwright`, `github`, `atlassian`, `figma`), con su `Para qué` y `Contexto` como descripción. Pon como marcados los de `optional.mcp` de un `config.json` previo. Solo se guarda la elección; el alta es el paso 3b.

Windows ya se resolvió en el paso 0a: no se pregunta de nuevo; el instalador lo registra en `config.json`.

Con las respuestas, sustituye `$ARGUMENTS` por `--only=deps,claude-md,settings,config` más `,taste` según lo elegido (también lo dado por flag), añade `--profile=<elegido>`, `--telemetry=on|off`, `--mcp=<elegidos separados por comas, o vacío>` y, si eligió 2–3, `--telemetry-every=<valor>`, quita los `--with-*` ya incorporados y conserva `--no-sandbox` y `--windows`. Un paso desmarcado no se ejecuta: taste-skill no se activa solo. Recuerda `MCP_ELEGIDOS` (los de `--mcp=` o los marcados) para el paso 3b.

## 1. Simulación

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --dry-run $ARGUMENTS` y resume en pocas líneas qué cambiaría (CLAUDE.md, settings.json, config.json). No pegues el diff entero.

## 2. Ejecución real

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --yes $ARGUMENTS`.

Este paso escribe en `~/.claude` (settings.json, CLAUDE.md, backups), que está protegido por el sandbox: lanza el comando **fuera del sandbox** (`dangerouslyDisableSandbox: true`; en modo Windows no hay sandbox) y deja que el usuario lo apruebe en el aviso de permiso. Si lo deniega, no insistas. El script hace backup previo; `--rollback` lo deshace.

## 3. Dependencias

Si la salida contiene un aviso de dependencias del sandbox («sin TTY: ejecuta tú en un terminal: sudo apt-get install …»), muestra ese comando tal cual al usuario para que lo lance él con `!` o en un terminal. No ejecutes `sudo`.

## 3b. MCP elegidos

Solo si el paso 2 terminó bien y `MCP_ELEGIDOS` no está vacío (con `--only=` sin `config` o con `--rollback` se salta): invoca `lf:mcp` con la herramienta Skill y esos nombres como argumento. Si no hay elegidos, no digas nada de MCP. Si el usuario deniega el alta, sigue al cierre con los `! …` pendientes.

## 4. Cierre

Pide que reinicie la sesión para cargar CLAUDE.md, settings y hooks nuevos. Sugiere `/sandbox`, `/permissions` y `/context` para comprobarlo. En modo Windows añade, tal cual: «Windows y WSL tienen configuraciones separadas (`C:\Users\<usuario>\.claude` frente a `~/.claude` de la distro): si también usas VS Code conectado a WSL, instala allí el plugin `lf` (`/plugins`) y repite `/lf:setup`.». Sin más comentarios.
