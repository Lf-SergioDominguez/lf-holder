#!/usr/bin/env bash
# gsd-lean.sh — crea o ajusta .planning/config.json de GSD con la plantilla barata del arnés.
#
# Sin config: copia templates/planning-config.json. Con config: impone solo las claves que
# gobiernan el coste (perfil de modelos, bucles de revisión, agentes opcionales y
# encadenamiento de fases), con los valores de la plantilla; el resto del proyecto (mode,
# gates, granularity…) se conserva. Apaga además `_auto_chain_active`, que puede quedar
# encendido tras una ejecución --auto interrumpida.
# Imprime las claves que cambian con su valor anterior, para poder deshacer a mano.
#
# Uso: gsd-lean.sh [dir-proyecto ...]   (por defecto, el directorio actual)
set -euo pipefail
command -v jq >/dev/null 2>&1 || { echo "gsd-lean: falta jq" >&2; exit 1; }
root="$(cd "$(dirname "$0")/.." && pwd)"
tpl="$root/templates/planning-config.json"

[ $# -eq 0 ] && set -- .
rc=0
for dir in "$@"; do
  cfg="$dir/.planning/config.json"
  if [ ! -f "$cfg" ]; then
    mkdir -p "$dir/.planning"
    cp "$tpl" "$cfg"
    echo "gsd-lean: creado $cfg"
    continue
  fi
  if ! jq -e 'type == "object"' "$cfg" >/dev/null 2>&1; then
    echo "gsd-lean: $cfg no es un objeto JSON válido; no lo toco" >&2
    rc=1; continue
  fi
  new=$(jq -s '.[0] * (.[1] | {model_profile, workflow: (.workflow | {research, plan_check,
      verifier, auto_advance, nyquist_validation, ui_phase, plan_bounce, cross_ai_execution,
      context_guard_mode, compact_content, post_planning_gaps})}
      | .workflow |= with_entries(select(.value != null)) | with_entries(select(.value != null)))
    | .workflow._auto_chain_active = false' "$cfg" "$tpl")
  changes=$(jq -rn --argjson a "$(cat "$cfg")" --argjson b "$new" '
    [$b | paths(type != "object" and type != "array")] | map(. as $p | select((try ($a | getpath($p)) catch null) != ($b | getpath($p)))
      | "  \(map(tostring) | join(".")): \(try ($a | getpath($p)) catch null | tojson) -> \($b | getpath($p) | tojson)") | .[]')
  if [ -z "$changes" ]; then
    echo "gsd-lean: $cfg ya estaba en modo barato"
  else
    printf '%s\n' "$new" > "$cfg"
    echo "gsd-lean: ajustado $cfg"
    printf '%s\n' "$changes"
  fi
done
exit "$rc"
