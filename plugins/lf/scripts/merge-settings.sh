#!/usr/bin/env bash
# merge-settings.sh — fusiona un fragmento JSON en ~/.claude/settings.json con backup.
#
# Reglas de fusión:
#   - objetos: recursivo (las claves del fragmento ganan)
#   - arrays de strings (permissions.allow/ask/deny, excludedCommands, allowedDomains): unión sin duplicados
#   - arrays de hooks: se añaden las entradas cuyo `command` no exista ya (dedupe por comando)
#   - escalares: el fragmento gana
#
# Uso: merge-settings.sh <fragmento.json> [--target ~/.claude/settings.json] [--dry-run] [--no-sandbox]
set -euo pipefail

FRAG="${1:?uso: merge-settings.sh <fragmento.json> [--target FILE] [--dry-run] [--no-sandbox]}"; shift
TARGET="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
DRY=0; NOSANDBOX=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --no-sandbox) NOSANDBOX=1; shift ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null || { echo "jq es necesario" >&2; exit 1; }
[ -f "$FRAG" ] || { echo "no existe $FRAG" >&2; exit 1; }
[ -f "$TARGET" ] || echo '{}' > "$TARGET"
jq -e . "$TARGET" >/dev/null || { echo "$TARGET no es JSON válido; abortando" >&2; exit 1; }

FRAG_JSON=$(cat "$FRAG")
if [ "$NOSANDBOX" -eq 1 ]; then
  # Sin sandbox no hay auto-allow de Bash: usamos dontAsk (lo no permitido se deniega sin preguntar).
  FRAG_JSON=$(jq '.permissions.defaultMode = "dontAsk" | .sandbox = {enabled: false}' <<<"$FRAG_JSON")
fi

# Ambos JSON entran por stdin (input; input), no como argumentos: --argjson con el
# settings.json completo revienta el límite de línea de comandos de Windows (~32 KB).
MERGED=$({ cat "$TARGET"; printf '%s\n' "$FRAG_JSON"; } | jq -n '
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
  input as $a | input as $b | merge($a; $b)
')

if [ "$DRY" -eq 1 ]; then
  echo "== diff $TARGET (actual → fusionado) =="
  diff <(jq -S . "$TARGET") <(jq -S . <<<"$MERGED") || true
  exit 0
fi

BACKUP_DIR="$(dirname "$TARGET")/backups"; mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/settings.json.lf-$(date +%Y%m%d-%H%M%S).bak"
cp "$TARGET" "$BACKUP"
TMP=$(mktemp); jq . <<<"$MERGED" > "$TMP" && mv "$TMP" "$TARGET"
echo "settings fusionados en $TARGET (backup: $BACKUP)"
