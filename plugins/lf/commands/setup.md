---
description: Configura el arnés LF en ~/.claude (CLAUDE.md global, settings, GSD) desde el plugin ya instalado, sin clonar el repo.
argument-hint: "[--with-rtk] [--with-taste] [--only=…] [--no-sandbox] [--windows] [--rollback]"
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

`$ARGUMENTS` solo admite los flags de `argument-hint` (`--with-rtk`, `--with-taste`, `--only=<pasos separados por comas>`, `--rollback`, `--no-sandbox`, `--windows`). Si contiene cualquier otra cosa, no ejecutes nada y dilo. Si no existe o `jq` no devuelve nada, para y di que el plugin `lf` no está instalado (`/plugin install lf@lefebvriano-holder`).

## 0b. Guía: qué activar

Siempre se aplican los pasos base: dependencias del sandbox, CLAUDE.md global y settings. Lo demás es opcional y se elige aquí. Salta este paso entero si `$ARGUMENTS` contiene `--only=` o `--rollback`.

Construye la lista de opcionales **pendientes de preguntar**, quitando los que ya vengan dados por flag (`--with-rtk`, `--with-taste`) o ya estén activos:

- **RTK**: ya activo si `bash "PLUGIN_ROOT/scripts/rtk.sh" status` dice `hook: activo`.
- **taste-skill**: ya activo si `~/.claude/settings.json` tiene `enabledPlugins["taste-skill@taste-skill"]`.
- **Poda de GSD**: solo si existe `~/.claude/gsd-core`.

Si queda alguno, haz **una sola pregunta** con AskUserQuestion, `multiSelect: true`, «¿Qué opcionales quieres activar? (sin marcar ninguno, solo se aplica la base)», con una opción por pendiente:

- **RTK**: filtra la salida de los comandos Bash antes de que llegue al modelo. Descarga un binario de github.com. Se activa o desactiva luego con `/lf:rtk`.
- **taste-skill**: skill de diseño anti-slop (dirección artística, imágenes reales, inspector en navegador). Más potente y configurable que `frontend-design`, pero más pesada en contexto; según su README el inspector necesita Node 22+ y Chrome/Edge/Chromium. Solo el plugin principal, no `taste-skill-classics`.
- **Poda de GSD**: quita sus hooks salvo write-guard, aplica el perfil `core` y retira agentes sueltos. Reduce el contexto fijo por sesión.

Con las respuestas, sustituye `$ARGUMENTS` por `--only=deps,claude-md,settings` más `,gsd`, `,rtk` y `,taste` según lo elegido (también lo dado por flag), quitando de `$ARGUMENTS` los `--with-*` ya incorporados y conservando `--no-sandbox` y `--windows`. Un paso desmarcado no se ejecuta, aunque sea de los antiguos por defecto: la poda de GSD ya no se aplica sola.

## 1. Simulación

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --dry-run $ARGUMENTS` y resume en pocas líneas qué cambiaría (CLAUDE.md, settings.json, GSD). No pegues el diff entero.

## 2. Ejecución real

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --yes $ARGUMENTS`.

Este paso escribe en `~/.claude` (settings.json, CLAUDE.md, backups), que está protegido por el sandbox: lanza el comando **fuera del sandbox** (`dangerouslyDisableSandbox: true`; en modo Windows no hay sandbox) y deja que el usuario lo apruebe en el aviso de permiso. Si lo deniega, no insistas. El script hace backup previo; `--rollback` lo deshace.

## 3. Dependencias

Si la salida contiene un aviso de dependencias del sandbox («sin TTY: ejecuta tú en un terminal: sudo apt-get install …»), muestra ese comando tal cual al usuario para que lo lance él con `!` o en un terminal. No ejecutes `sudo`.

## 4. Cierre

Pide que reinicie la sesión para cargar CLAUDE.md, settings y hooks nuevos. Si activó RTK, recuérdale que lo puede apagar y encender con `/lf:rtk off|on`. Sugiere `/sandbox`, `/permissions` y `/context` para comprobarlo. En modo Windows añade, tal cual: «Windows y WSL tienen configuraciones separadas (`C:\Users\<usuario>\.claude` frente a `~/.claude` de la distro): si también usas VS Code conectado a WSL, instala allí el plugin `lf` (`/plugins`) y repite `/lf:setup`.». Sin más comentarios.
