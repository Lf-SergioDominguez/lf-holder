#!/usr/bin/env bash
# merge-settings.sh — fusiona un fragmento JSON en ~/.claude/settings.json con backup y manifiesto.
#
# Reglas de fusión:
#   - objetos: recursivo (las claves del fragmento ganan)
#   - arrays de strings (permissions.allow/ask/deny, excludedCommands, allowedDomains): unión sin duplicados
#   - arrays de hooks: se añaden las entradas cuyo `command` no exista ya (dedupe por comando)
#   - escalares: el fragmento gana
#
# Manifiesto (~/.claude/lf/managed.json, junto al target): lista lo que el arnés puso en settings.json
# (reglas, excludedCommands, allowWrite, dominios, comandos de hook). Con --prune se retira primero
# lo que el manifiesto anterior contenía —lo del usuario no se toca— y después se añade el fragmento,
# de modo que las bajas del arnés llegan a quien ya lo tenía instalado. Sin manifiesto se usa
# home/managed-legacy.json (unión de todo lo publicado hasta 0.10). Sin --prune solo se añade y se
# amplía el manifiesto (fragmentos opcionales: nosandbox, taste).
#
# Uso: merge-settings.sh <fragmento.json> [--target FILE] [--dry-run] [--no-sandbox] [--prune]
set -euo pipefail

FRAG="${1:?uso: merge-settings.sh <fragmento.json> [--target FILE] [--dry-run] [--no-sandbox] [--prune]}"; shift
TARGET="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
DRY=0; NOSANDBOX=0; PRUNE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --no-sandbox) NOSANDBOX=1; shift ;;
    --prune) PRUNE=1; shift ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null || { echo "jq es necesario" >&2; exit 1; }
[ -f "$FRAG" ] || { echo "no existe $FRAG" >&2; exit 1; }
[ -f "$TARGET" ] || echo '{}' > "$TARGET"
jq -e . "$TARGET" >/dev/null || { echo "$TARGET no es JSON válido; abortando" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$(dirname "$TARGET")/lf/managed.json"
LEGACY="$HERE/../home/managed-legacy.json"

FRAG_JSON=$(cat "$FRAG")
if [ "$NOSANDBOX" -eq 1 ]; then
  # Sin sandbox no hay auto-allow de Bash: usamos dontAsk (lo no permitido se deniega sin preguntar).
  FRAG_JSON=$(jq '.permissions.defaultMode = "dontAsk" | .sandbox = {enabled: false}' <<<"$FRAG_JSON")
fi

# Lo que el arnés ha puesto antes: manifiesto propio o, si no existe, el histórico.
if [ -f "$MANIFEST" ] && jq -e . "$MANIFEST" >/dev/null 2>&1; then PREV_FILE="$MANIFEST"
elif [ -f "$LEGACY" ]; then PREV_FILE="$LEGACY"
else PREV_FILE=""; fi
PREV_JSON='{}'; [ -n "$PREV_FILE" ] && PREV_JSON=$(cat "$PREV_FILE")
CUR_MANIFEST='{}'; [ -f "$MANIFEST" ] && jq -e . "$MANIFEST" >/dev/null 2>&1 && CUR_MANIFEST=$(cat "$MANIFEST")

# Los tres JSON entran por stdin (input; input; input), no como argumentos: --argjson con el
# settings.json completo revienta el límite de línea de comandos de Windows (~32 KB).
OUT=$({ cat "$TARGET"; printf '%s\n' "$FRAG_JSON"; printf '%s\n' "$PREV_JSON"; printf '%s\n' "$CUR_MANIFEST"; } | jq -n --argjson prune "$PRUNE" '
  def hookcmds: [ .[]?.hooks[]?.command ];
  def merge(a; b):
    if (a|type) == "object" and (b|type) == "object" then
      reduce ((a|keys_unsorted) + (b|keys_unsorted) | unique[]) as $k ({};
        .[$k] = (if (a|has($k)) and (b|has($k)) then merge(a[$k]; b[$k])
                 elif (b|has($k)) then b[$k] else a[$k] end))
    elif (a|type) == "array" and (b|type) == "array" then
      if ((a + b) | all(type == "string")) then (a + b | unique)
      elif ((a + b) | all(type == "object" and has("hooks"))) then
        # arrays de hooks: añadir solo entradas con comandos nuevos
        (a|hookcmds) as $have
        | a + [ b[] | select( ([.hooks[]?.command] - $have) | length > 0 ) ]
      else b end
    else b end;

  def paths: [["permissions","allow"],["permissions","ask"],["permissions","deny"],
              ["sandbox","excludedCommands"],["sandbox","filesystem","allowWrite"],["sandbox","network","allowedDomains"]];

  # Quita de $t lo que lista el manifiesto $m (reglas y comandos de hook).
  def strip($m):
    . as $t
    # effortLevel "high" lo ponía el arnés hasta 0.10; ahora manda modelSettings (medium).
    | (if .effortLevel == "high" then del(.effortLevel) else . end)
    | reduce paths[] as $p (.;
        if (getpath($p)|type) == "array" then setpath($p; getpath($p) - ($m|getpath($p) // [])) else . end)
    | if (.hooks|type) == "object" then
        .hooks |= (
          with_entries(.value |= (
            if type == "array" then
              map(if has("hooks") then
                    .hooks |= map(select(.command as $c
                      | ($m.hookCommands // []) | any(. as $h | $c == $h or ($c|endswith(" " + $h)) or ($c|endswith("/" + $h))) | not))
                  else . end)
              | map(select((.hooks // [1]) | length > 0))
            else . end))
          | with_entries(select(.value != [])))
      else . end;

  input as $a | input as $b | input as $prev | input as $cur
  | (if $prune == 1 then ($a | strip($prev)) else $a end) as $base
  | (if $prune == 1 then {} else $cur end) as $man0
  | merge($base; $b) as $merged
  | ( reduce paths[] as $p ({};
        setpath($p; (($man0 | getpath($p) // []) + ($b | getpath($p) // [])) | unique))
      | .hookCommands = (($man0.hookCommands // []) + [ $b.hooks // {} | .[][]? | .hooks[]? | .command ] | unique) ) as $man
  | {settings: $merged, manifest: $man}
')
MERGED=$(jq '.settings' <<<"$OUT")
NEW_MANIFEST=$(jq '.manifest' <<<"$OUT")

if [ "$DRY" -eq 1 ]; then
  echo "== diff $TARGET (actual → fusionado) =="
  diff <(jq -S . "$TARGET") <(jq -S . <<<"$MERGED") || true
  exit 0
fi

BACKUP_DIR="$(dirname "$TARGET")/backups"; mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/settings.json.lf-$(date +%Y%m%d-%H%M%S).bak"
cp "$TARGET" "$BACKUP"
TMP=$(mktemp); jq . <<<"$MERGED" > "$TMP" && mv "$TMP" "$TARGET"
mkdir -p "$(dirname "$MANIFEST")"
jq . <<<"$NEW_MANIFEST" > "$MANIFEST"
echo "settings fusionados en $TARGET (backup: $BACKUP; manifiesto: $MANIFEST)"
