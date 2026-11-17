#!/usr/bin/env bash
# bash-gate.sh — hook PreToolUse(Bash) del plugin lf: lanzador del clasificador gate/cli.mjs.
# LF_GATE=on (por defecto) decide; shadow solo registra en lf-metrics/gate.tsv; off no hace nada.
# Siempre sale 0. Sin node no hay clasificador: en shadow/off no hace nada y en `on` solo pregunta
# por los patrones más peligrosos, dejando pasar el resto.
set -uo pipefail

mode=$(printf '%s' "${LF_GATE:-on}" | tr '[:upper:]' '[:lower:]')
[ "$mode" = "off" ] && exit 0

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node_bin=""
np="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/lf/node-path"
if [ -r "$np" ]; then
  cand=$(head -n 1 "$np" 2>/dev/null)
  [ -n "$cand" ] && [ -x "$cand" ] && node_bin="$cand"
fi
[ -n "$node_bin" ] || node_bin=$(command -v node 2>/dev/null || true)

if [ -n "$node_bin" ]; then
  exec "$node_bin" "$here/gate/cli.mjs"
fi

[ "$mode" = "on" ] || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
if printf '%s' "$cmd" | grep -Eiq 'rm |drop|delete|truncate|--force|push|sudo'; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"lf-gate: sin node, comando con patron peligroso"}}'
fi
exit 0
