#!/usr/bin/env bash
# prune-gsd-hooks.sh — elimina de ~/.claude/settings.json los hooks de GSD salvo gsd-write-guard.
#
# Motivo: GSD registra 18 hooks (guards, monitores, banners) que se ejecutan en cada tool call,
# inyectan contexto y empujan al flujo GSD. Fuera de tareas L no aportan nada. write-guard se
# conserva porque protege ROADMAP/STATE en .planning/ y solo actúa ahí.
# GSD los vuelve a registrar en cada `gsd update` ("only-if-absent"): este script es idempotente,
# ejecútalo después de actualizar GSD (el hook lf check-drift avisa al inicio de sesión).
#
# Uso: prune-gsd-hooks.sh [--target FILE] [--dry-run] [--keep REGEX]
set -euo pipefail
TARGET="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
DRY=0; KEEP='gsd-write-guard'
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --keep) KEEP="$2"; shift 2 ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done
command -v jq >/dev/null || { echo "jq es necesario" >&2; exit 1; }
[ -f "$TARGET" ] || { echo "no existe $TARGET"; exit 0; }

before=$(jq '[.hooks // {} | .[][]? | .hooks[]? | .command // "" | select(test("/gsd-"))] | length' "$TARGET")
PRUNED=$(jq --arg keep "$KEEP" '
  if .hooks then
    .hooks |= (with_entries(
      .value |= (map(.hooks |= map(select(((.command // "") | test("/gsd-") | not) or ((.command // "") | test($keep)))))
                 | map(select((.hooks | length) > 0)))
    ) | with_entries(select((.value | length) > 0)))
    | if (.hooks | length) == 0 then del(.hooks) else . end
  else . end' "$TARGET")
after=$(jq '[.hooks // {} | .[][]? | .hooks[]? | .command // "" | select(test("/gsd-"))] | length' <<<"$PRUNED")

if [ "$DRY" -eq 1 ]; then
  echo "hooks gsd-*: $before → $after (dry-run)"
  diff <(jq -S . "$TARGET") <(jq -S . <<<"$PRUNED") || true
  exit 0
fi
if [ "$before" -eq "$after" ]; then echo "hooks gsd-*: $before (sin cambios)"; exit 0; fi

BACKUP_DIR="$(dirname "$TARGET")/backups"; mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/settings.json.lf-$(date +%Y%m%d-%H%M%S).bak"
cp "$TARGET" "$BACKUP"
TMP=$(mktemp); jq . <<<"$PRUNED" > "$TMP" && mv "$TMP" "$TARGET"
echo "hooks gsd-*: $before → $after (backup: $BACKUP)"
