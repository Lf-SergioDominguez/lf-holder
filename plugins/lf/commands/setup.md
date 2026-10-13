---
description: Configura el arnés LF en ~/.claude (CLAUDE.md global, settings, GSD) desde el plugin ya instalado, sin clonar el repo.
argument-hint: "[--with-rtk] [--only=…] [--rollback]"
---

Instala o actualiza la parte del arnés que un plugin no puede aportar. Argumentos: `$ARGUMENTS`

## 0a. Comprobar que la sesión corre en Linux, macOS o WSL

Antes de nada ejecuta `uname -s`. Si empieza por `MINGW`, `MSYS` o `CYGWIN`, o la ruta del plugin o de `~/.claude` es de Windows (`C:/…`, `C:\…`), **para aquí**. No instales `jq`, no busques WSL por tu cuenta (`wsl.exe`, `\\wsl$`) y no lances el script con rutas de Windows. Explica al usuario, en estas palabras:

> Claude Code se está ejecutando en Windows, no en WSL. Aunque la ventana de VS Code esté conectada a WSL, la extensión Claude Code está instalada solo en local. Arreglo: Extensiones → Claude Code → **Install in WSL: \<distro\>**; después `Ctrl+Shift+P` → *Developer: Reload Window*; en el panel de Claude, `/plugins` → añade `Lf-SergioDominguez/lf-holder` e instala `lf`; y repite `/lf:setup`.

## 0. Resolver la ruta del plugin

Usa `${CLAUDE_PLUGIN_ROOT}` si aparece sustituida por una ruta real (absoluta, sin `${`). Si llega literal o vacía, resuélvela así y úsala como `PLUGIN_ROOT` en los pasos siguientes:

```bash
jq -r '.plugins["lf@lefebvriano-holder"][0].installPath // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
```

Comprueba que `PLUGIN_ROOT/scripts/install.sh` existe.

`$ARGUMENTS` solo admite los flags de `argument-hint` (`--with-rtk`, `--only=<pasos separados por comas>`, `--rollback`, `--no-sandbox`). Si contiene cualquier otra cosa, no ejecutes nada y dilo. Si no existe o `jq` no devuelve nada, para y di que el plugin `lf` no está instalado (`/plugin install lf@lefebvriano-holder`).

## 1. Simulación

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --dry-run $ARGUMENTS` y resume en pocas líneas qué cambiaría (CLAUDE.md, settings.json, GSD). No pegues el diff entero.

## 2. Ejecución real

Ejecuta `bash "PLUGIN_ROOT/scripts/install.sh" --yes $ARGUMENTS`.

Este paso escribe en `~/.claude` (settings.json, CLAUDE.md, backups), que está protegido por el sandbox: lanza el comando **fuera del sandbox** (`dangerouslyDisableSandbox: true`) y deja que el usuario lo apruebe en el aviso de permiso. Si lo deniega, no insistas. El script hace backup previo; `--rollback` lo deshace.

## 3. Dependencias

Si la salida contiene un aviso de dependencias del sandbox («sin TTY: ejecuta tú en un terminal: sudo apt-get install …»), muestra ese comando tal cual al usuario para que lo lance él con `!` o en un terminal. No ejecutes `sudo`.

## 4. Cierre

Pide que reinicie la sesión para cargar CLAUDE.md, settings y hooks nuevos. Sugiere `/sandbox`, `/permissions` y `/context` para comprobarlo. Sin más comentarios.
