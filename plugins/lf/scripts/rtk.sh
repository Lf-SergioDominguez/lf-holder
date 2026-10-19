#!/usr/bin/env bash
# rtk.sh — activa, desactiva o consulta el hook de RTK en ~/.claude/settings.json.
#
#   status  informa de si el binario existe y si el hook `rtk hook claude` está registrado
#   on      instala RTK si falta y registra el hook (delega en install.sh --only=rtk)
#   off     quita el hook de settings.json con backup; deja el binario y los permisos (reversible con `on`)
#
# Uso: rtk.sh status|on|off
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
export PATH="$HOME/.local/bin:$PATH"

command -v jq >/dev/null || { echo "jq es necesario (apt-get install jq)" >&2; exit 1; }

hook_on() {
  [ -f "$SETTINGS" ] && jq -e '[.hooks.PreToolUse[]?.hooks[]?.command // empty | select(test("rtk hook claude"))] | length > 0' "$SETTINGS" >/dev/null 2>&1
}

case "${1:-status}" in
  status)
    if command -v rtk >/dev/null; then echo "binario: $(command -v rtk) ($(rtk --version 2>/dev/null | head -1))"; else echo "binario: no instalado"; fi
    if hook_on; then echo "hook: activo (los comandos Bash pasan por RTK)"; else echo "hook: inactivo"; fi
    ;;
  on)
    exec bash "$ROOT/scripts/install.sh" --only=rtk --yes
    ;;
  off)
    if ! hook_on; then echo "el hook de RTK ya está inactivo"; exit 0; fi
    mkdir -p "$CLAUDE_DIR/backups"
    BACKUP="$CLAUDE_DIR/backups/settings.json.lf-$(date +%Y%m%d-%H%M%S).bak"
    cp "$SETTINGS" "$BACKUP"
    TMP=$(mktemp)
    jq '
      .hooks.PreToolUse |= (map(.hooks |= map(select((.command // "") | test("rtk hook claude") | not))) | map(select((.hooks | length) > 0)))
      | if (.hooks.PreToolUse | length) == 0 then del(.hooks.PreToolUse) else . end
    ' "$SETTINGS" > "$TMP" && mv "$TMP" "$SETTINGS"
    echo "hook de RTK retirado de $SETTINGS (backup: $BACKUP). Reactívalo con: /lf:rtk on"
    ;;
  *)
    echo "uso: rtk.sh status|on|off" >&2; exit 1 ;;
esac
