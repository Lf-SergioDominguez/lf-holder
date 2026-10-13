#!/usr/bin/env bash
# filter-output.sh — hook PreToolUse(Bash) del plugin lf.
#
# Envuelve comandos ruidosos que RTK no filtra (Symfony console, builds de Astro/Vite,
# tsc/vue-tsc, composer misc, npm/yarn/bun install, wp-cli, mysql -e) y, sobre todo,
# los que van dentro de `docker compose exec <svc> …`, que RTK no ve.
# Devuelve `updatedInput` (el tool_input original con `command` sustituido, para conservar
# `timeout`, `description`, etc.) con el comando envuelto en un filtro; el exit code original se
# preserva con ${PIPESTATUS[0]}. Si no aplica, sale 0 sin salida (passthrough).
# Se usa `awk 'NR<=N'` en lugar de `head -n N`: awk lee toda la entrada y evita el SIGPIPE que
# mataría a mitad un comando de larga duración (p. ej. `wp search-replace`).
#
# Acepta un único prefijo `cd <ruta> && ` (ruta sin espacios ni metacaracteres) y lo conserva
# delante del comando envuelto: `cd X && { cmd; } 2>&1 | filtro; exit ${PIPESTATUS[0]}`.
#
# Nunca toca: comandos ya prefijados con `rtk`, pipes, redirecciones, heredocs,
# sustituciones de comando, multilínea, asignaciones de variables, ni cadenas con más de un
# `&&` / `;` / `||`.
#
# Log completo de las salidas filtradas: ${TMPDIR:-/tmp}/lf-out-<session_id>.log (por sesión;
# sin session_id en la entrada, lf-last-output.log).
set -euo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

# Separa un único prefijo `cd <ruta> && ` (solo caracteres seguros en la ruta); el resto del
# comando sigue las mismas reglas de siempre.
cdprefix=""
if [[ "$cmd" =~ ^(cd[[:space:]]+[A-Za-z0-9_./~@%+=:,-]+[[:space:]]+\&\&[[:space:]]+)(.+)$ ]]; then
  cdprefix="${BASH_REMATCH[1]}"
  cmd="${BASH_REMATCH[2]}"
fi

# Passthrough por seguridad: construcciones que no podemos envolver sin riesgo.
case "$cmd" in
  *"|"*|*">"*|*"&"*|*"#"*|*"<<"*|*'$('*|*'`'*|*"||"*|*";"*|*$'\n'*) exit 0 ;;
  "rtk "*|*" rtk "*) exit 0 ;;
esac
[[ "$cmd" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && exit 0

# Desenvuelve `docker compose exec [-T] [-u user] <svc> <inner>` / `docker-compose exec …`
prefix=""
inner="$cmd"
if [[ "$cmd" =~ ^((docker[[:space:]]+compose|docker-compose)[[:space:]]+exec([[:space:]]+-[A-Za-z]+([[:space:]]+[^[:space:]-][^[:space:]]*)?)*[[:space:]]+[A-Za-z0-9_.-]+[[:space:]]+)(.+)$ ]]; then
  prefix="${BASH_REMATCH[1]}"
  inner="${BASH_REMATCH[5]}"
fi

# Log por sesión para que sesiones paralelas no se pisen.
sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null) || sid=""
sid="${sid//[^A-Za-z0-9_-]/}"
if [ -n "$sid" ]; then
  log='${TMPDIR:-/tmp}'"/lf-out-${sid}.log"
else
  log='${TMPDIR:-/tmp}/lf-last-output.log'
fi
filter=""
post=""
note=""
case "$inner" in
  # Symfony console
  "php bin/console debug:"*|"bin/console debug:"*|"symfony console debug:"*)
    filter="awk 'NR<=120'"; note="Symfony debug (120 líneas)" ;;
  "php bin/console "*|"bin/console "*|"symfony console "*)
    filter="grep -vE '^[[:space:]]*$' | tail -n 40"; note="Symfony console (40 líneas)" ;;
  # PHP tests / static analysis (dentro de docker RTK no los ve)
  *"vendor/bin/phpunit"*|*"vendor/bin/pest"*|*"vendor/bin/paratest"*|*"bin/phpunit"*)
    filter="tee \"$log\" | grep -E 'FAILURES|ERRORS|Tests:|OK \(|^[0-9]+\) |Error|Failed|Exception|Deprecat|:[0-9]+$|Time:' | awk 'NR<=120'"
    note="PHPUnit: solo fallos y resumen" ;;
  *"vendor/bin/phpstan"*|*"vendor/bin/psalm"*)
    filter="tee \"$log\" | grep -E 'Line|ERROR|error|Found|No errors|\[' | awk 'NR<=100'"; note="phpstan/psalm resumido" ;;
  *"vendor/bin/php-cs-fixer"*|*"vendor/bin/phpcs"*|*"vendor/bin/rector"*)
    filter="tee \"$log\" | tail -n 40"; note="lint PHP (40 líneas)" ;;
  # Builds frontend
  "npx astro build"*|"astro build"*|"npx astro check"*|"astro check"*|"npm run build"*|"bun run build"*|"pnpm run build"*|"pnpm build"*|"yarn build"*|"npx vite build"*|"vite build"*)
    filter="tee \"$log\" | grep -Ei -A4 'error|warn|fail|✘|×' | awk 'NR<=80'"; post="tail -n 3 \"$log\""
    note="build: errores/avisos + 3 últimas líneas (log completo en $log)" ;;
  "npx vue-tsc"*|"vue-tsc"*|"npx tsc"*|"tsc "*|"tsc")
    filter="tee \"$log\" | grep -E 'error TS|Found ' | awk 'NR<=80'"; note="tsc: solo errores" ;;
  # Gestores de dependencias
  "composer dump-autoload"*|"composer validate"*|"composer show"*|"composer outdated"*|"composer why"*)
    filter="tail -n 20"; note="composer (20 líneas)" ;;
  "npm install"*|"npm ci"*|"npm i "*|"npm i"|"yarn"|"yarn install"*|"yarn add "*|"bun install"*|"pnpm install"*|"pnpm i"*)
    filter="tee \"$log\" | grep -Ei 'error|warn|added|removed|audited|up to date|done|packages' | tail -n 15"
    note="install: resumen" ;;
  # WordPress CLI y MySQL
  "wp "*)
    filter="awk 'NR<=60'"; note="wp-cli (60 líneas)" ;;
  "mysql "*" -e "*|"mysql "*" --execute"*)
    filter="awk 'NR<=60'"; note="mysql (60 filas)" ;;
esac

[ -n "$filter" ] || exit 0

if [ -n "$post" ]; then
  wrapped="${cdprefix}{ ${prefix}${inner}; } 2>&1 | ${filter}; s=\${PIPESTATUS[0]}; ${post}; exit \$s"
else
  wrapped="${cdprefix}{ ${prefix}${inner}; } 2>&1 | ${filter}; exit \${PIPESTATUS[0]}"
fi

ti=$(printf '%s' "$input" | jq -c '.tool_input // {}' 2>/dev/null) || exit 0
jq -cn --argjson ti "$ti" --arg c "$wrapped" --arg n "$note" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecisionReason: ("lf: salida filtrada — " + $n),
    updatedInput: ($ti + {command: $c})
  }
}'
