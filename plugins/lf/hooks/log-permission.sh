#!/usr/bin/env bash
# log-permission.sh — hook PermissionRequest del plugin lf.
# Registra cada prompt de permiso en un TSV para medir la fricción (objetivo: 0 en tareas S/M).
# Columnas: ts, session_id, cwd, tool, comando/ruta (≤600), permission_mode, dangerouslyDisableSandbox (1/0).
# AskUserQuestion y ExitPlanMode no son fricción de permisos: no se registran.
# No toma ninguna decisión: sale 0 sin salida.
set -uo pipefail
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/lf-metrics"
mkdir -p "$dir" 2>/dev/null || exit 0
input=$(cat)
printf '%s' "$input" | jq -r '
  select((.tool_name // "") as $t | ["AskUserQuestion","ExitPlanMode"] | index($t) | not)
  | [ (now|todate), (.session_id // ""), (.cwd // ""), (.tool_name // ""),
      ((.tool_input.command // .tool_input.file_path // "") | tostring | gsub("[\n\t]"; " ") | .[0:600]),
      (.permission_mode // ""),
      (if .tool_input.dangerouslyDisableSandbox == true then 1 else 0 end) ] | @tsv' \
  >> "$dir/permissions.tsv" 2>/dev/null || true
exit 0
