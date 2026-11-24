---
description: Telemetría opt-in del arnés: estado, vista previa del informe, envío y desactivación.
argument-hint: "status|preview|send|off"
disable-model-invocation: true
---

Informe agregado y anónimo del uso del arnés (ADR 0023). Argumento: `$ARGUMENTS`

Solo admite `status`, `preview`, `send` u `off`. Con otra cosa o vacío, no ejecutes nada y lista las cuatro.

## 0. Resolver la ruta del plugin

Usa `${CLAUDE_PLUGIN_ROOT}` si aparece sustituida por una ruta real (absoluta, sin `${`). Si llega literal o vacía:

```bash
jq -r '.plugins["lf@lefebvriano-holder"][0].installPath // empty' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
```

Si no devuelve nada, para y di que el plugin `lf` no está instalado. El script es `PLUGIN_ROOT/scripts/telemetry.mjs` (Node 22+).

## status

`node "PLUGIN_ROOT/scripts/telemetry.mjs" status`. Resume en una línea: activada o no, frecuencia, último envío y cuándo toca el siguiente.

## preview

`node "PLUGIN_ROOT/scripts/telemetry.mjs" preview` y muestra el JSON tal cual, sin resumirlo: es lo que se enviaría. Si sale con código 2, el informe traía una clave fuera de la lista blanca (`scripts/telemetry-schema.json`): no hay nada que enviar; dilo y para.

## send

1. Ejecuta `preview` y enseña el JSON.
2. Una pregunta con AskUserQuestion: «¿Abrir una issue con este informe en `Lf-SergioDominguez/lf-holder-metrics`? La abre tu cuenta de GitHub, así que tu usuario será visible aunque el contenido sea anónimo». Opciones: **Enviar** y **No enviar**. Con «No enviar», para.
3. `node "PLUGIN_ROOT/scripts/telemetry.mjs" send`. Usa `gh` y red, así que va **fuera del sandbox** (`dangerouslyDisableSandbox: true`), sin pipes ni redirecciones. Si la telemetría está desactivada, dilo y sugiere `/lf:setup --telemetry=on`. Si responde `"sent": false`, aún no toca; ofrece `--force` solo si el usuario lo pide.
4. Da la URL de la issue. Si falla `gh` (sin `gh auth login`, sin acceso al repo o falta la etiqueta `telemetry`), da el error y no reintentes: el último envío no avanza.

## off

`node "PLUGIN_ROOT/scripts/telemetry.mjs" off`. Escribe en `~/.claude/lf/config.json`, protegido por el sandbox: va **fuera del sandbox** y el usuario lo aprueba en el aviso. Confirma que queda desactivada; reactivarla es `/lf:setup --telemetry=on`.
