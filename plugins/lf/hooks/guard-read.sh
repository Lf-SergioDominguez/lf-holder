#!/usr/bin/env bash
# guard-read.sh — hook PreToolUse(Read) del plugin lf.
#
# Deniega lecturas que casi nunca compensan en tokens: dependencias, artefactos de build,
# cachés, lockfiles, minificados y source maps; y ficheros muy grandes leídos enteros.
# El motivo de la denegación dice qué hacer en su lugar (grep -n + Read acotado).
# Va como hook y no como `permissions.deny` porque el sandbox replica el deny como denyRead
# en los procesos hijos y rompía tsc, composer y git (ver docs/DECISIONS.md).
#
# Reglas de ruta (sobre la ruta relativa al `cwd` de la sesión):
#   - vendor/, node_modules/, .git/ → en cualquier segmento.
#   - var/cache/, dist/, public/build/, coverage/ → solo en la raíz del proyecto (así
#     `src/dist/a.ts` pasa).
#   - Ruta fuera del cwd: solo reglas de nombre de fichero y de tamaño (evita falsos
#     positivos con /home/u/vendor/proyecto).
# Reglas de nombre: *.min.js, *.min.css, *.map, package-lock.json, composer.lock,
#   yarn.lock, pnpm-lock.yaml.
# Tamaño (sin offset ni limit): más de LF_READ_MAX_LINES líneas (800) o LF_READ_MAX_BYTES
#   bytes (300000, cubre JSON y bundles de una sola línea). No aplica a imágenes, PDF ni ipynb.
#
# Escapes (los fija la persona en su entorno; el agente no puede): LF_READ_GUARD=0 lo
# desactiva todo; LF_READ_MAX_LINES y LF_READ_MAX_BYTES cambian los umbrales.
# Sin jq o sin ruta → passthrough (exit 0 sin salida).
set -euo pipefail

[ "${LF_READ_GUARD:-1}" = "0" ] && exit 0

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "$file" ] || exit 0
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null) || cwd=""
cwd="${cwd%/}"

deny() {
  jq -cn --arg r "lf: $1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

# Ruta absoluta (para comprobar existencia y tamaño) y ruta relativa al cwd (para las reglas).
# inside=0 si la ruta queda fuera del cwd o sube por «..».
rel="$file"; abs="$file"; inside=1
if [[ "$file" == /* ]]; then
  if [ -n "$cwd" ] && [[ "$file" == "$cwd"/* ]]; then rel="${file#"$cwd"/}"; else inside=0; fi
else
  [ -n "$cwd" ] && abs="$cwd/$file"
fi
while [[ "$rel" == ./* ]]; do rel="${rel#./}"; done
[[ "/$rel/" == */../* ]] && inside=0

if [ "$inside" = "1" ]; then
  case "/$rel" in
    */vendor/*|*/node_modules/*)
      deny "lectura bloqueada ($rel está en dependencias). Lee el fuente del proyecto; si necesitas una API de la dependencia, usa grep -n sobre el símbolo y no recorras el directorio." ;;
    */.git/*)
      deny "lectura bloqueada ($rel está en .git). Usa git log, git show o git diff por Bash." ;;
  esac
  case "$rel" in
    var/cache/*|dist/*|public/build/*|coverage/*)
      deny "lectura bloqueada ($rel es un artefacto generado). Lee el fuente en vez del compilado; si buscas un error, usa grep -n sobre el log o la salida del build." ;;
  esac
fi

case "${file##*/}" in
  *.min.js|*.min.css|*.map)
    deny "lectura bloqueada ($file es minificado o source map). Lee el fuente original en vez del compilado." ;;
  package-lock.json|composer.lock|yarn.lock|pnpm-lock.yaml)
    deny "lectura bloqueada ($file es un lockfile). Busca la dependencia con grep -n '<paquete>' $file y lee solo ese rango con offset/limit." ;;
  # Imágenes, PDF y notebooks: Read los trata de forma especial, sin umbral de tamaño.
  *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.ipynb) exit 0 ;;
esac

# Fichero grande sin offset ni limit.
has_range=$(printf '%s' "$input" | jq -r '(.tool_input.offset != null or .tool_input.limit != null)' 2>/dev/null) || exit 0
if [ "$has_range" = "false" ] && [ -f "$abs" ]; then
  max_lines="${LF_READ_MAX_LINES:-800}";   [[ "$max_lines" =~ ^[0-9]+$ ]] || max_lines=800
  max_bytes="${LF_READ_MAX_BYTES:-300000}"; [[ "$max_bytes" =~ ^[0-9]+$ ]] || max_bytes=300000
  lines=$(wc -l < "$abs" 2>/dev/null | tr -d '[:space:]') || exit 0
  bytes=$(wc -c < "$abs" 2>/dev/null | tr -d '[:space:]') || exit 0
  if [ "${lines:-0}" -gt "$max_lines" ]; then
    deny "$file tiene $lines líneas. Localiza con grep -n '<patrón>' $file y vuelve a llamar a Read con offset y limit."
  fi
  if [ "${bytes:-0}" -gt "$max_bytes" ]; then
    deny "$file pesa $bytes bytes. Localiza con grep -n -o '<patrón>' $file (o grep -c) y vuelve a llamar a Read con offset y limit; si es JSON o un bundle de una línea, usa jq o grep -o sobre el campo que buscas."
  fi
fi
exit 0
