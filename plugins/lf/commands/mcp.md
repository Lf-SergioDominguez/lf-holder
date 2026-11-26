---
description: Onboarding guiado de MCP opcionales (playwright, github, atlassian, figma): requisitos, alta, login, verificación y prueba.
argument-hint: "[playwright|github|atlassian|figma …]"
---

Monta uno o varios MCP opcionales con alcance `user`. Argumentos: `$ARGUMENTS`

La fuente de verdad es `docs/MCP.md` del plugin: de cada ficha usa `Requisitos`, `Comando`, `Auth`, `Verificar` y `Permisos`; **no copies comandos aquí ni los reescribas**.

## 0. Qué montar y dónde está la ficha

`$ARGUMENTS` solo admite nombres de la lista cerrada `playwright`, `github`, `atlassian` y `figma`, separados por espacios o comas. Con cualquier otra cosa no ejecutes nada: dilo y lista los cuatro. Sin argumentos, usa `optional.mcp` de `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/lf/config.json` (`jq -r '.optional.mcp[]?'`); si está vacío, no hay nada que montar: sugiere `/lf:setup --mcp=<lista>` y para.

Resuelve `PLUGIN_ROOT` con `${CLAUDE_PLUGIN_ROOT}` si es una ruta real (absoluta, sin `${`). Si llega literal o vacía:

```bash
jq -r '.plugins["lf@lefebvriano-holder"][0].installPath // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
```

Si no devuelve nada, para y di que el plugin `lf` no está instalado. Lee `PLUGIN_ROOT/docs/MCP.md` y, de él, solo las fichas pedidas (Read con offset/limit o `grep -n '^## '`).

## 1. Por cada MCP, en orden

Un MCP que falla no frena a los demás: explica el motivo y pasa al siguiente.

1. **Ya montado.** `claude mcp get <n>`. Si existe, o `claude mcp list` muestra un conector claude.ai del mismo servicio conectado (Atlassian, Figma), no lo dupliques: salta al paso 5.
2. **Requisitos.** Playwright: `node -v` ≥ 20. GitHub: `gh auth status`; si falla, pide al usuario `! gh auth login` y pasa al siguiente. Atlassian y Figma: informa de cuenta, plan y aprobación de admin según la ficha; no se comprueba.
3. **Alta.** Ejecuta el `Comando` de la ficha tal cual, un comando por llamada y **fuera del sandbox** (`dangerouslyDisableSandbox: true`: escribe en `~/.claude.json`); el usuario lo aprueba en el aviso. Si lo deniega, muestra el comando con `! …` y sigue. En Windows nativo, Playwright usa `cmd /c npx` (ver ficha).
4. **Login** (Atlassian y Figma). Indica: `/mcp` → servidor → Authenticate; en WSL sin navegador, `claude mcp login <n> --no-browser`. No lo lances tú: abre un navegador.
5. **Verificar.** `claude mcp get <n>` en estado conectado. Si no, da el error y para con ese MCP. Las herramientas aparecen al reiniciar la sesión.
6. **Prueba.** Da la petición de solo lectura de `Verificar` para hacerla en la próxima sesión.

## 2. Cierre

Una línea por MCP: montado, ya existía, falta login o denegado (con el `! …` pendiente). Después, en 2 líneas: cada herramienta MCP pide permiso por defecto (no se escriben reglas `allow`; revisa las de escritura caso a caso), y para deshacer `claude mcp remove <n> -s user` (más `claude mcp logout <n>` solo si hubo login: Atlassian y Figma; Playwright y GitHub no lo tienen). Pide reiniciar la sesión y sugiere `/context` para medir el coste. Sin más comentarios.
