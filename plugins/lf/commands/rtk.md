---
description: Activa, desactiva o consulta RTK (filtro de la salida de Bash antes de que llegue al modelo).
argument-hint: "[on|off|status]"
---

Acción: **$ARGUMENTS** (sin argumento, `status`).

`$ARGUMENTS` solo admite `on`, `off` o `status`. Si trae otra cosa, no ejecutes nada y dilo.

## 0. Resolver la ruta del plugin

Usa `${CLAUDE_PLUGIN_ROOT}` si aparece sustituida por una ruta real (absoluta, sin `${`). Si llega literal o vacía, resuélvela así y úsala como `PLUGIN_ROOT`:

```bash
jq -r '.plugins["lf@lefebvriano-holder"][0].installPath // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
```

Si no existe o `jq` no devuelve nada, para y di que el plugin `lf` no está instalado (`/plugin install lf@lefebvriano-holder`).

## 1. Ejecutar

- `status`: ejecuta `bash "PLUGIN_ROOT/scripts/rtk.sh" status` (solo lectura, dentro del sandbox) y resume en una línea.
- `on` / `off`: escriben en `~/.claude`, que está protegido por el sandbox. Ejecuta `bash "PLUGIN_ROOT/scripts/rtk.sh" <on|off>` **fuera del sandbox** (`dangerouslyDisableSandbox: true`) y deja que el usuario lo apruebe. Si lo deniega, no insistas. `on` instala RTK si falta (descarga de github.com) y registra el hook; `off` solo retira el hook, con backup, y deja el binario.

## 2. Cierre

Di el estado resultante y que hay que **reiniciar la sesión** para que el cambio de hooks surta efecto. Sin más comentarios.
