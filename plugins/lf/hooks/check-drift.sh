#!/usr/bin/env bash
# check-drift.sh — hook SessionStart del plugin lf.
# Silencioso salvo en tres casos (una línea cada uno):
#   1. ~/.claude/CLAUDE.md no lleva la marca `<!-- lf-harness X.Y.Z -->` en la línea 1 → sin configurar.
#   2. La marca no coincide con la versión del plugin → actualizado, falta /lf:setup.
#   3. GSD ha re-registrado hooks gsd-* distintos de write-guard en settings.json.
set -uo pipefail
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
settings="$dir/settings.json"
claude_md="$dir/CLAUDE.md"
command -v jq >/dev/null 2>&1 || exit 0

# versión del plugin (CLAUDE_PLUGIN_ROOT; si no está, ruta relativa al propio script)
root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)}"
ver=$(jq -r '.version // empty' "$root/.claude-plugin/plugin.json" 2>/dev/null || true)

if [ -n "$ver" ]; then
  mark=$(head -n 1 "$claude_md" 2>/dev/null | grep -oE '^<!-- lf-harness [^ ]+ -->$' || true)
  mark="${mark#<!-- lf-harness }"; mark="${mark% -->}"
  if [ -z "$mark" ]; then
    echo "Arnés LF sin configurar: ejecuta /lf:setup"
  elif [ "$mark" != "$ver" ]; then
    echo "Arnés LF actualizado a $ver: ejecuta /lf:setup"
  fi
fi

if [ -f "$settings" ]; then
  n=$(jq -r '[.hooks // {} | .[][]? | .hooks[]? | .command // "" | select(test("/gsd-") and (test("gsd-write-guard")|not))] | length' "$settings" 2>/dev/null || echo 0)
  if [ "${n:-0}" -gt 0 ]; then
    echo "lf: GSD ha re-registrado $n hook(s) en settings.json; ejecuta /lf:setup --only=gsd para volver a podarlos."
  fi
fi
exit 0
